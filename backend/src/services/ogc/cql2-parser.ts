import { sql, SQL } from 'drizzle-orm';
import {
  parseText,
  type Expression,
  type ExpressionVisitor,
  BinaryExpression,
  FunctionExpression,
  AdvancedComparisonExpression,
  PropertyExpression,
  LiteralExpression,
  GeometryExpression,
  UnaryExpression,
  GroupingExpression,
  ArrayExpression,
  BBoxExpression,
  GeometryCollectionExpression,
  IntervalExpression,
  IsNullOperatorExpression,
  OperatorExpression,
} from 'cql2-filters-parser';
import { InvalidFilterError } from './ogc-error.js';
import type { CollectionConfig } from './collection-registry.js';

/**
 * Supported CQL2 operators for this implementation
 */
const SUPPORTED_OPERATORS = new Set([
  // Logical
  'and', 'or', 'not',
  // Comparison
  '=', '<>', '<', '<=', '>', '>=',
  // Advanced comparison
  'like', 'between', 'in',
  // Spatial
  's_intersects', 's_within', 's_disjoint', 's_equals', 's_touches', 's_overlaps', 's_crosses', 's_contains',
]);

/**
 * Spatial operators that need S_DWITHIN handling
 * Note: S_DWITHIN is handled as a function, not a binary operator
 */
const SPATIAL_OPERATORS = new Set([
  's_intersects', 's_within', 's_disjoint', 's_equals',
  's_touches', 's_overlaps', 's_crosses', 's_contains',
]);

/**
 * Context for SQL generation visitor
 */
interface SqlGeneratorContext {
  config: CollectionConfig;
  params: unknown[];
  geometryColumn: string;
}

/**
 * Visitor that converts CQL2 AST to PostGIS SQL
 */
class SqlGeneratorVisitor implements ExpressionVisitor<SQL, SqlGeneratorContext> {
  visitBinaryExpression(expr: BinaryExpression, context: SqlGeneratorContext): SQL {
    const op = expr.operator.toJSON().toLowerCase();

    // Check if operator is supported
    if (!SUPPORTED_OPERATORS.has(op)) {
      throw new InvalidFilterError(`Unsupported operator: ${op}`);
    }

    // Handle spatial operators
    if (SPATIAL_OPERATORS.has(op)) {
      return this.handleSpatialOperator(op, expr.left, expr.right, context);
    }

    // Handle comparison operators
    const left = expr.left.accept(this, context);
    const right = expr.right.accept(this, context);

    switch (op) {
      case '=':
        return sql`(${left} = ${right})`;
      case '<>':
        return sql`(${left} <> ${right})`;
      case '<':
        return sql`(${left} < ${right})`;
      case '<=':
        return sql`(${left} <= ${right})`;
      case '>':
        return sql`(${left} > ${right})`;
      case '>=':
        return sql`(${left} >= ${right})`;
      case 'and':
        return sql`(${left} AND ${right})`;
      case 'or':
        return sql`(${left} OR ${right})`;
      default:
        throw new InvalidFilterError(`Unsupported binary operator: ${op}`);
    }
  }

  visitFunctionExpression(expr: FunctionExpression, context: SqlGeneratorContext): SQL {
    const funcName = expr.operator.toJSON().toLowerCase();

    // Handle spatial functions
    if (SPATIAL_OPERATORS.has(funcName)) {
      if (expr.args.length < 2) {
        throw new InvalidFilterError(`${funcName} requires at least 2 arguments`);
      }
      return this.handleSpatialOperator(funcName, expr.args[0], expr.args[1], context);
    }

    // Handle S_DWITHIN specially (has distance parameter)
    if (funcName === 's_dwithin') {
      if (expr.args.length < 3) {
        throw new InvalidFilterError('S_DWITHIN requires geometry, geometry, and distance arguments');
      }
      return this.handleDWithin(expr.args[0], expr.args[1], expr.args[2], context);
    }

    throw new InvalidFilterError(`Unsupported function: ${funcName}`);
  }

  visitAdvancedComparisonExpression(expr: AdvancedComparisonExpression, context: SqlGeneratorContext): SQL {
    const op = expr.operator.toJSON().toLowerCase();

    switch (op) {
      case 'like': {
        if (expr.args.length < 2) {
          throw new InvalidFilterError('LIKE requires property and pattern');
        }
        const prop = expr.args[0].accept(this, context);
        const pattern = expr.args[1].accept(this, context);
        return expr.negate
          ? sql`(${prop} NOT LIKE ${pattern})`
          : sql`(${prop} LIKE ${pattern})`;
      }
      case 'between': {
        if (expr.args.length < 3) {
          throw new InvalidFilterError('BETWEEN requires property and two bounds');
        }
        const prop = expr.args[0].accept(this, context);
        const lower = expr.args[1].accept(this, context);
        const upper = expr.args[2].accept(this, context);
        return expr.negate
          ? sql`(${prop} NOT BETWEEN ${lower} AND ${upper})`
          : sql`(${prop} BETWEEN ${lower} AND ${upper})`;
      }
      case 'in': {
        if (expr.args.length < 2) {
          throw new InvalidFilterError('IN requires property and values list');
        }
        const prop = expr.args[0].accept(this, context);
        const values = expr.args.slice(1).map(arg => arg.accept(this, context));
        const valueList = sql.join(values, sql`, `);
        return expr.negate
          ? sql`(${prop} NOT IN (${valueList}))`
          : sql`(${prop} IN (${valueList}))`;
      }
      default:
        throw new InvalidFilterError(`Unsupported advanced comparison: ${op}`);
    }
  }

  visitPropertyExpression(expr: PropertyExpression, context: SqlGeneratorContext): SQL {
    const propName = expr.name;

    // Check if property is queryable for this collection
    if (!context.config.queryables.includes(propName)) {
      throw new InvalidFilterError(
        `Property '${propName}' is not queryable for collection '${context.config.id}'. ` +
        `Queryable properties: ${context.config.queryables.join(', ')}`
      );
    }

    // Map property name to column name
    const columnName = context.config.propertyMap[propName];
    if (!columnName) {
      throw new InvalidFilterError(`Property '${propName}' has no column mapping`);
    }

    // Special case: 'geometry' property refers to the geometry column
    if (propName === 'geometry') {
      return sql.raw(context.geometryColumn);
    }

    return sql.raw(columnName);
  }

  visitLiteralExpression(expr: LiteralExpression, context: SqlGeneratorContext): SQL {
    const value = expr.value;
    const type = expr.type;

    if (value === null) {
      return sql`NULL`;
    }

    switch (type) {
      case 'string':
        context.params.push(value);
        return sql`${value}`;
      case 'number':
        context.params.push(value);
        return sql`${value}`;
      case 'boolean':
        return value ? sql`TRUE` : sql`FALSE`;
      case 'timestamp':
      case 'date':
        context.params.push(value);
        return sql`${value}`;
      default:
        context.params.push(value);
        return sql`${value}`;
    }
  }

  visitGeometryExpression(expr: GeometryExpression, context: SqlGeneratorContext): SQL {
    // Convert to WKT and create PostGIS geometry
    const wkt = expr.toText();
    return sql`ST_GeomFromText(${wkt}, 4326)`;
  }

  visitUnaryExpression(expr: UnaryExpression, context: SqlGeneratorContext): SQL {
    const op = expr.operator.toJSON().toLowerCase();
    const operand = expr.right.accept(this, context);

    if (op === 'not') {
      return sql`(NOT ${operand})`;
    }
    if (op === '-') {
      return sql`(-${operand})`;
    }

    throw new InvalidFilterError(`Unsupported unary operator: ${op}`);
  }

  visitGroupingExpression(expr: GroupingExpression, context: SqlGeneratorContext): SQL {
    const inner = expr.expression.accept(this, context);
    return sql`(${inner})`;
  }

  visitArrayExpression(expr: ArrayExpression, context: SqlGeneratorContext): SQL {
    const items = expr.expressions.map(e => e.accept(this, context));
    return sql`(${sql.join(items, sql`, `)})`;
  }

  visitBBoxExpression(expr: BBoxExpression, context: SqlGeneratorContext): SQL {
    if (expr.values.length < 4) {
      throw new InvalidFilterError('BBOX requires at least 4 values');
    }

    const values = expr.values.map(v => {
      const lit = v.accept(this, context);
      return lit;
    });

    // Create PostGIS envelope from bbox
    return sql`ST_MakeEnvelope(${values[0]}, ${values[1]}, ${values[2]}, ${values[3]}, 4326)`;
  }

  visitGeometryCollectionExpression(expr: GeometryCollectionExpression, context: SqlGeneratorContext): SQL {
    const wkt = expr.toText();
    return sql`ST_GeomFromText(${wkt}, 4326)`;
  }

  visitIntervalExpression(expr: IntervalExpression, _context: SqlGeneratorContext): SQL {
    throw new InvalidFilterError('INTERVAL expressions are not supported');
  }

  visitIsNullOperatorExpression(expr: IsNullOperatorExpression, context: SqlGeneratorContext): SQL {
    const operand = expr.expression.accept(this, context);
    return expr.negate
      ? sql`(${operand} IS NOT NULL)`
      : sql`(${operand} IS NULL)`;
  }

  visitOperatorExpression(_expr: OperatorExpression, _context: SqlGeneratorContext): SQL {
    throw new InvalidFilterError('Bare operator expressions are not supported');
  }

  /**
   * Handle spatial operators (S_INTERSECTS, S_WITHIN, etc.)
   */
  private handleSpatialOperator(
    op: string,
    left: Expression,
    right: Expression,
    context: SqlGeneratorContext
  ): SQL {
    // Determine which side is the property and which is the geometry
    let propSql: SQL;
    let geomSql: SQL;

    if (left instanceof PropertyExpression) {
      propSql = left.accept(this, context);
      geomSql = right.accept(this, context);
    } else if (right instanceof PropertyExpression) {
      propSql = right.accept(this, context);
      geomSql = left.accept(this, context);
    } else {
      // Both sides are geometry literals
      propSql = left.accept(this, context);
      geomSql = right.accept(this, context);
    }

    switch (op) {
      case 's_intersects':
        return sql`ST_Intersects(${propSql}, ${geomSql})`;
      case 's_within':
        return sql`ST_Within(${propSql}, ${geomSql})`;
      case 's_disjoint':
        return sql`ST_Disjoint(${propSql}, ${geomSql})`;
      case 's_equals':
        return sql`ST_Equals(${propSql}, ${geomSql})`;
      case 's_touches':
        return sql`ST_Touches(${propSql}, ${geomSql})`;
      case 's_overlaps':
        return sql`ST_Overlaps(${propSql}, ${geomSql})`;
      case 's_crosses':
        return sql`ST_Crosses(${propSql}, ${geomSql})`;
      case 's_contains':
        return sql`ST_Contains(${propSql}, ${geomSql})`;
      default:
        throw new InvalidFilterError(`Unsupported spatial operator: ${op}`);
    }
  }

  /**
   * Handle S_DWITHIN with distance parameter
   * Distance is always in meters (using geography cast)
   */
  private handleDWithin(
    geom1: Expression,
    geom2: Expression,
    distance: Expression,
    context: SqlGeneratorContext
  ): SQL {
    const g1 = geom1.accept(this, context);
    const g2 = geom2.accept(this, context);
    const dist = distance.accept(this, context);

    // Use geography cast for accurate distance in meters
    return sql`ST_DWithin(${g1}::geography, ${g2}::geography, ${dist})`;
  }
}

/**
 * Parse CQL2 text and convert to PostGIS SQL
 *
 * @param filterText - CQL2 text filter string
 * @param config - Collection configuration for property validation
 * @returns SQL condition that can be added to WHERE clause
 * @throws InvalidFilterError if filter is invalid or unsupported
 */
export function parseCql2ToSql(filterText: string, config: CollectionConfig): SQL {
  try {
    const expression = parseText(filterText);
    const visitor = new SqlGeneratorVisitor();
    const context: SqlGeneratorContext = {
      config,
      params: [],
      geometryColumn: config.geometryColumn,
    };

    return expression.accept(visitor, context);
  } catch (error) {
    if (error instanceof InvalidFilterError) {
      throw error;
    }
    throw new InvalidFilterError(
      `Failed to parse CQL2 filter: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate that a filter is parseable without executing it
 */
export function validateCql2Filter(filterText: string, config: CollectionConfig): string | null {
  try {
    parseCql2ToSql(filterText, config);
    return null; // Valid
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
