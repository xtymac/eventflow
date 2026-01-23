import { Type, Static } from '@sinclair/typebox';

// OGC API Common schemas

export const LinkSchema = Type.Object({
  href: Type.String(),
  rel: Type.String(),
  type: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  hreflang: Type.Optional(Type.String()),
});

export type Link = Static<typeof LinkSchema>;

export const ExtentSpatialSchema = Type.Object({
  bbox: Type.Array(Type.Array(Type.Number(), { minItems: 4, maxItems: 6 })),
  crs: Type.Optional(Type.String()),
});

export const ExtentTemporalSchema = Type.Object({
  interval: Type.Array(Type.Array(Type.Union([Type.String(), Type.Null()]), { minItems: 2, maxItems: 2 })),
  trs: Type.Optional(Type.String()),
});

export const ExtentSchema = Type.Object({
  spatial: Type.Optional(ExtentSpatialSchema),
  temporal: Type.Optional(ExtentTemporalSchema),
});

export type Extent = Static<typeof ExtentSchema>;

export const CollectionSchema = Type.Object({
  id: Type.String(),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  extent: Type.Optional(ExtentSchema),
  itemType: Type.Optional(Type.Literal('feature')),
  crs: Type.Optional(Type.Array(Type.String())),
  storageCrs: Type.Optional(Type.String()),
  links: Type.Array(LinkSchema),
});

export type Collection = Static<typeof CollectionSchema>;

export const CollectionsSchema = Type.Object({
  collections: Type.Array(CollectionSchema),
  links: Type.Array(LinkSchema),
});

export const LandingPageSchema = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.String()),
  conformsTo: Type.Optional(Type.Array(Type.String())),
  links: Type.Array(LinkSchema),
});

export const ConformanceSchema = Type.Object({
  conformsTo: Type.Array(Type.String()),
});

// GeoJSON Feature schemas
export const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

export const FeatureSchema = Type.Object({
  type: Type.Literal('Feature'),
  id: Type.Union([Type.String(), Type.Number()]),
  properties: Type.Record(Type.String(), Type.Unknown()),
  geometry: Type.Union([GeometrySchema, Type.Null()]),
  links: Type.Optional(Type.Array(LinkSchema)),
});

export type Feature = Static<typeof FeatureSchema>;

export const FeatureCollectionSchema = Type.Object({
  type: Type.Literal('FeatureCollection'),
  features: Type.Array(FeatureSchema),
  links: Type.Array(LinkSchema),
  numberReturned: Type.Number(),
  numberMatched: Type.Optional(Type.Number()),
  timeStamp: Type.Optional(Type.String()),
});

export type FeatureCollection = Static<typeof FeatureCollectionSchema>;

// Problem+JSON error schema (RFC 7807)
export const ProblemDetailSchema = Type.Object({
  type: Type.Optional(Type.String()),
  title: Type.String(),
  status: Type.Integer(),
  detail: Type.String(),
  instance: Type.Optional(Type.String()),
});

export type ProblemDetail = Static<typeof ProblemDetailSchema>;
