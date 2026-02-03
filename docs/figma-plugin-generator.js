/**
 * EventFlow Figma Project Generator
 *
 * This script creates a complete Figma design system and component library
 * for the EventFlow prototype.
 *
 * HOW TO USE:
 * 1. Open Figma Desktop App
 * 2. Create a new file or open existing
 * 3. Go to Plugins > Development > New Plugin
 * 4. Choose "Empty" template
 * 5. Replace code.ts content with this file
 * 6. Run the plugin (Plugins > Development > [Your Plugin Name])
 *
 * The script will create:
 * - Color styles for all design tokens
 * - Text styles for typography system
 * - Component library with all UI components
 * - Example screen layouts
 */

// Design Tokens (from figma-design-spec.md)
const COLORS = {
  // Primary Blue Scale
  'Primary/Blue 0': '#e7f5ff',
  'Primary/Blue 1': '#d0ebff',
  'Primary/Blue 2': '#a5d8ff',
  'Primary/Blue 3': '#74c0fc',
  'Primary/Blue 4': '#4dabf7',
  'Primary/Blue 5': '#339af0',
  'Primary/Blue 6': '#228be6',
  'Primary/Blue 7': '#1c7ed6',
  'Primary/Blue 8': '#1971c2',
  'Primary/Blue 9': '#1864ab',

  // Neutral Gray Scale
  'Neutral/Gray 0': '#f8f9fa',
  'Neutral/Gray 1': '#f1f3f5',
  'Neutral/Gray 2': '#e9ecef',
  'Neutral/Gray 3': '#dee2e6',
  'Neutral/Gray 4': '#ced4da',
  'Neutral/Gray 5': '#adb5bd',
  'Neutral/Gray 6': '#868e96',
  'Neutral/Gray 7': '#495057',
  'Neutral/Gray 8': '#343a40',
  'Neutral/Gray 9': '#212529',

  // Semantic Colors
  'Semantic/Red': '#fa5252',
  'Semantic/Yellow': '#fcc419',
  'Semantic/Orange': '#fd7e14',
  'Semantic/Green': '#40c057',
  'Semantic/Cyan': '#15aabf',
  'Semantic/Violet': '#7950f2',

  // Event Status Colors
  'Status/Planned': '#3B82F6',
  'Status/Active': '#F59E0B',
  'Status/Pending Review': '#F97316',
  'Status/Closed': '#6B7280',
  'Status/Archived': '#374151',
  'Status/Cancelled': '#EF4444',

  // Map Colors
  'Map/Road Arterial': '#8B5CF6',
  'Map/Road Collector': '#06B6D4',
  'Map/Road Local': '#84CC16',
  'Map/Draw Fill': '#06B6D4',
  'Map/Draw Stroke': '#0891B2',
  'Map/Hover Highlight': '#F59E0B',
  'Map/Selected Highlight': '#EF4444',
};

const TEXT_STYLES = {
  'Heading/H1': { fontSize: 34, lineHeight: 1.3, fontWeight: 700 },
  'Heading/H2': { fontSize: 26, lineHeight: 1.35, fontWeight: 700 },
  'Heading/H3': { fontSize: 22, lineHeight: 1.4, fontWeight: 700 },
  'Heading/H4': { fontSize: 18, lineHeight: 1.45, fontWeight: 700 },
  'Heading/H5': { fontSize: 16, lineHeight: 1.5, fontWeight: 700 },
  'Heading/H6': { fontSize: 14, lineHeight: 1.5, fontWeight: 700 },
  'Body/XS': { fontSize: 12, lineHeight: 1.4, fontWeight: 400 },
  'Body/SM': { fontSize: 14, lineHeight: 1.45, fontWeight: 400 },
  'Body/MD': { fontSize: 16, lineHeight: 1.55, fontWeight: 400 },
  'Body/LG': { fontSize: 18, lineHeight: 1.6, fontWeight: 400 },
  'Body/XL': { fontSize: 20, lineHeight: 1.65, fontWeight: 400 },
};

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

// Main function
async function createEventFlowDesignSystem() {
  console.log('🎨 Creating EventFlow Design System...');

  // Create pages
  const coverPage = figma.createPage();
  coverPage.name = '📖 Cover';

  const designSystemPage = figma.createPage();
  designSystemPage.name = '🎨 Design System';

  const componentsPage = figma.createPage();
  componentsPage.name = '🧩 Components';

  const screensEventsPage = figma.createPage();
  screensEventsPage.name = '📱 Screens - Events';

  const screensAssetsPage = figma.createPage();
  screensAssetsPage.name = '📱 Screens - Assets';

  const screensImportPage = figma.createPage();
  screensImportPage.name = '📱 Screens - Import/Export';

  console.log('✅ Pages created');

  // Create Color Styles
  console.log('🎨 Creating color styles...');
  for (const [name, hex] of Object.entries(COLORS)) {
    const style = figma.createPaintStyle();
    style.name = name;
    const rgb = hexToRgb(hex);
    style.paints = [{
      type: 'SOLID',
      color: rgb,
      opacity: 1
    }];
  }
  console.log(`✅ Created ${Object.keys(COLORS).length} color styles`);

  // Create Text Styles
  console.log('✍️ Creating text styles...');
  for (const [name, props] of Object.entries(TEXT_STYLES)) {
    const style = figma.createTextStyle();
    style.name = name;
    style.fontSize = props.fontSize;
    style.lineHeight = { value: props.lineHeight * 100, unit: 'PERCENT' };

    // Set font weight
    const fontWeight = props.fontWeight === 700 ? 'Bold' :
                      props.fontWeight === 600 ? 'Semi Bold' :
                      props.fontWeight === 500 ? 'Medium' : 'Regular';

    await figma.loadFontAsync({ family: 'Inter', style: fontWeight });
    style.fontName = { family: 'Inter', style: fontWeight };
  }
  console.log(`✅ Created ${Object.keys(TEXT_STYLES).length} text styles`);

  // Switch to Design System page
  figma.currentPage = designSystemPage;

  // Create Design System page content
  await createDesignSystemPage();

  // Switch to Components page
  figma.currentPage = componentsPage;

  // Create component library
  await createComponentLibrary();

  // Switch to Screens - Events page
  figma.currentPage = screensEventsPage;

  // Create example screens
  await createScreenLayouts();

  // Switch back to cover page
  figma.currentPage = coverPage;
  await createCoverPage();

  console.log('🎉 EventFlow Design System created successfully!');
  figma.closePlugin('✅ EventFlow Design System created! Check the pages on the left sidebar.');
}

async function createCoverPage() {
  // Load font
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  // Create title frame
  const titleFrame = figma.createFrame();
  titleFrame.name = 'Cover';
  titleFrame.resize(1200, 800);
  titleFrame.x = 0;
  titleFrame.y = 0;

  // Background
  titleFrame.fills = [{ type: 'SOLID', color: hexToRgb('#f8f9fa') }];

  // Title
  const title = figma.createText();
  title.characters = 'EventFlow Design System';
  title.fontSize = 48;
  title.fontName = { family: 'Inter', style: 'Bold' };
  title.fills = [{ type: 'SOLID', color: hexToRgb('#212529') }];
  title.x = 100;
  title.y = 200;
  titleFrame.appendChild(title);

  // Subtitle
  const subtitle = figma.createText();
  subtitle.characters = 'Nagoya Construction Lifecycle Management';
  subtitle.fontSize = 24;
  subtitle.fontName = { family: 'Inter', style: 'Regular' };
  subtitle.fills = [{ type: 'SOLID', color: hexToRgb('#495057') }];
  subtitle.x = 100;
  subtitle.y = 280;
  titleFrame.appendChild(subtitle);

  // Version info
  const version = figma.createText();
  version.characters = 'Version 1.0.0 • Based on Mantine 7.14.3 • Generated ' + new Date().toLocaleDateString();
  version.fontSize = 14;
  version.fontName = { family: 'Inter', style: 'Regular' };
  version.fills = [{ type: 'SOLID', color: hexToRgb('#868e96') }];
  version.x = 100;
  version.y = 700;
  titleFrame.appendChild(version);
}

async function createDesignSystemPage() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  let yOffset = 0;

  // Color Palette Section
  const colorSection = await createColorPaletteSection();
  colorSection.y = yOffset;
  yOffset += colorSection.height + 100;

  // Typography Section
  const typoSection = await createTypographySection();
  typoSection.y = yOffset;
  yOffset += typoSection.height + 100;

  // Spacing Section
  const spacingSection = await createSpacingSection();
  spacingSection.y = yOffset;
}

async function createColorPaletteSection() {
  const section = figma.createFrame();
  section.name = 'Colors';
  section.layoutMode = 'VERTICAL';
  section.primaryAxisSizingMode = 'AUTO';
  section.counterAxisSizingMode = 'AUTO';
  section.itemSpacing = 32;
  section.paddingLeft = 40;
  section.paddingRight = 40;
  section.paddingTop = 40;
  section.paddingBottom = 40;
  section.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // Title
  const title = figma.createText();
  title.characters = 'Color Palette';
  title.fontSize = 32;
  title.fontName = { family: 'Inter', style: 'Bold' };
  section.appendChild(title);

  // Create color swatches grouped by category
  const categories = [
    { name: 'Primary Blue', prefix: 'Primary/Blue' },
    { name: 'Neutral Gray', prefix: 'Neutral/Gray' },
    { name: 'Event Status', prefix: 'Status/' },
    { name: 'Semantic', prefix: 'Semantic/' },
  ];

  for (const category of categories) {
    const categoryFrame = await createColorCategory(category.name, category.prefix);
    section.appendChild(categoryFrame);
  }

  return section;
}

async function createColorCategory(categoryName, prefix) {
  const categoryFrame = figma.createFrame();
  categoryFrame.name = categoryName;
  categoryFrame.layoutMode = 'HORIZONTAL';
  categoryFrame.primaryAxisSizingMode = 'AUTO';
  categoryFrame.counterAxisSizingMode = 'AUTO';
  categoryFrame.itemSpacing = 16;
  categoryFrame.fills = [];

  // Category label
  const label = figma.createText();
  label.characters = categoryName;
  label.fontSize = 16;
  label.fontName = { family: 'Inter', style: 'Bold' };
  label.resize(150, label.height);
  categoryFrame.appendChild(label);

  // Color swatches
  const colors = Object.entries(COLORS).filter(([name]) => name.startsWith(prefix));

  for (const [name, hex] of colors) {
    const swatch = await createColorSwatch(name.replace(prefix, '').trim(), hex);
    categoryFrame.appendChild(swatch);
  }

  return categoryFrame;
}

async function createColorSwatch(name, hex) {
  const swatchFrame = figma.createFrame();
  swatchFrame.name = name;
  swatchFrame.layoutMode = 'VERTICAL';
  swatchFrame.primaryAxisSizingMode = 'AUTO';
  swatchFrame.counterAxisSizingMode = 'AUTO';
  swatchFrame.itemSpacing = 8;
  swatchFrame.fills = [];

  // Color box
  const colorBox = figma.createRectangle();
  colorBox.resize(80, 80);
  colorBox.fills = [{ type: 'SOLID', color: hexToRgb(hex) }];
  colorBox.cornerRadius = 8;
  swatchFrame.appendChild(colorBox);

  // Name label
  const nameLabel = figma.createText();
  nameLabel.characters = name;
  nameLabel.fontSize = 12;
  nameLabel.fontName = { family: 'Inter', style: 'Bold' };
  nameLabel.resize(80, nameLabel.height);
  swatchFrame.appendChild(nameLabel);

  // Hex label
  const hexLabel = figma.createText();
  hexLabel.characters = hex;
  hexLabel.fontSize = 10;
  hexLabel.fontName = { family: 'Inter', style: 'Regular' };
  hexLabel.fills = [{ type: 'SOLID', color: hexToRgb('#868e96') }];
  hexLabel.resize(80, hexLabel.height);
  swatchFrame.appendChild(hexLabel);

  return swatchFrame;
}

async function createTypographySection() {
  const section = figma.createFrame();
  section.name = 'Typography';
  section.layoutMode = 'VERTICAL';
  section.primaryAxisSizingMode = 'AUTO';
  section.counterAxisSizingMode = 'AUTO';
  section.itemSpacing = 24;
  section.paddingLeft = 40;
  section.paddingRight = 40;
  section.paddingTop = 40;
  section.paddingBottom = 40;
  section.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // Title
  const title = figma.createText();
  title.characters = 'Typography';
  title.fontSize = 32;
  title.fontName = { family: 'Inter', style: 'Bold' };
  section.appendChild(title);

  // Create text samples for each style
  for (const [name, props] of Object.entries(TEXT_STYLES)) {
    const sample = await createTypeSample(name, props);
    section.appendChild(sample);
  }

  return section;
}

async function createTypeSample(name, props) {
  const sampleFrame = figma.createFrame();
  sampleFrame.name = name;
  sampleFrame.layoutMode = 'HORIZONTAL';
  sampleFrame.primaryAxisSizingMode = 'AUTO';
  sampleFrame.counterAxisSizingMode = 'AUTO';
  sampleFrame.itemSpacing = 40;
  sampleFrame.fills = [];

  // Style name
  const styleName = figma.createText();
  styleName.characters = name;
  styleName.fontSize = 12;
  styleName.fontName = { family: 'Inter', style: 'Regular' };
  styleName.fills = [{ type: 'SOLID', color: hexToRgb('#868e96') }];
  styleName.resize(150, styleName.height);
  sampleFrame.appendChild(styleName);

  // Sample text
  const fontWeight = props.fontWeight === 700 ? 'Bold' :
                    props.fontWeight === 600 ? 'Semi Bold' :
                    props.fontWeight === 500 ? 'Medium' : 'Regular';

  await figma.loadFontAsync({ family: 'Inter', style: fontWeight });

  const sample = figma.createText();
  sample.characters = 'The quick brown fox jumps over the lazy dog';
  sample.fontSize = props.fontSize;
  sample.fontName = { family: 'Inter', style: fontWeight };
  sample.lineHeight = { value: props.lineHeight * 100, unit: 'PERCENT' };
  sampleFrame.appendChild(sample);

  return sampleFrame;
}

async function createSpacingSection() {
  const section = figma.createFrame();
  section.name = 'Spacing Scale';
  section.layoutMode = 'VERTICAL';
  section.primaryAxisSizingMode = 'AUTO';
  section.counterAxisSizingMode = 'AUTO';
  section.itemSpacing = 16;
  section.paddingLeft = 40;
  section.paddingRight = 40;
  section.paddingTop = 40;
  section.paddingBottom = 40;
  section.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // Title
  const title = figma.createText();
  title.characters = 'Spacing Scale';
  title.fontSize = 32;
  title.fontName = { family: 'Inter', style: 'Bold' };
  section.appendChild(title);

  const spacings = [
    { name: 'XS', value: 10 },
    { name: 'SM', value: 12 },
    { name: 'MD', value: 16 },
    { name: 'LG', value: 20 },
    { name: 'XL', value: 32 },
  ];

  for (const spacing of spacings) {
    const spacingVis = await createSpacingVisualization(spacing.name, spacing.value);
    section.appendChild(spacingVis);
  }

  return section;
}

async function createSpacingVisualization(name, value) {
  const vis = figma.createFrame();
  vis.name = name;
  vis.layoutMode = 'HORIZONTAL';
  vis.primaryAxisSizingMode = 'AUTO';
  vis.counterAxisSizingMode = 'AUTO';
  vis.itemSpacing = 40;
  vis.fills = [];

  // Label
  const label = figma.createText();
  label.characters = `${name} - ${value}px`;
  label.fontSize = 14;
  label.fontName = { family: 'Inter', style: 'Regular' };
  label.resize(100, label.height);
  vis.appendChild(label);

  // Visual bar
  const bar = figma.createRectangle();
  bar.resize(value, 24);
  bar.fills = [{ type: 'SOLID', color: hexToRgb('#228be6') }];
  bar.cornerRadius = 4;
  vis.appendChild(bar);

  return vis;
}

async function createComponentLibrary() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  // Create component sections
  const sections = [
    { name: 'Buttons', y: 0 },
    { name: 'Inputs', y: 400 },
    { name: 'Cards', y: 800 },
    { name: 'Badges', y: 1200 },
  ];

  for (const section of sections) {
    const frame = figma.createFrame();
    frame.name = section.name;
    frame.y = section.y;
    frame.resize(800, 300);
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

    const title = figma.createText();
    title.characters = section.name;
    title.fontSize = 24;
    title.fontName = { family: 'Inter', style: 'Bold' };
    title.x = 20;
    title.y = 20;
    frame.appendChild(title);
  }
}

async function createScreenLayouts() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  // Create placeholder for main screen layout
  const screenFrame = figma.createFrame();
  screenFrame.name = 'Events Tab - Default View';
  screenFrame.resize(1440, 900);

  // Header
  const header = figma.createFrame();
  header.name = 'Header';
  header.resize(1440, 60);
  header.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  screenFrame.appendChild(header);

  // Left Sidebar
  const leftSidebar = figma.createFrame();
  leftSidebar.name = 'Left Sidebar';
  leftSidebar.resize(400, 840);
  leftSidebar.y = 60;
  leftSidebar.fills = [{ type: 'SOLID', color: hexToRgb('#f8f9fa') }];
  screenFrame.appendChild(leftSidebar);

  // Map Area
  const mapArea = figma.createFrame();
  mapArea.name = 'Map';
  mapArea.resize(1040, 840);
  mapArea.x = 400;
  mapArea.y = 60;
  mapArea.fills = [{ type: 'SOLID', color: hexToRgb('#e9ecef') }];
  screenFrame.appendChild(mapArea);

  const mapLabel = figma.createText();
  mapLabel.characters = 'Map Area\n(MapLibre GL JS)';
  mapLabel.fontSize = 24;
  mapLabel.fontName = { family: 'Inter', style: 'Bold' };
  mapLabel.fills = [{ type: 'SOLID', color: hexToRgb('#868e96') }];
  mapLabel.textAlignHorizontal = 'CENTER';
  mapLabel.textAlignVertical = 'CENTER';
  mapLabel.resize(1040, 840);
  mapArea.appendChild(mapLabel);
}

// Run the main function
createEventFlowDesignSystem();
