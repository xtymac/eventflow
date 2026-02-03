# EventFlow Figma Project Setup Guide

This guide will help you create a comprehensive Figma design system and component library for the EventFlow prototype.

## 📦 What's Included

1. **figma-design-spec.md** - Complete design specification with all measurements, colors, and components
2. **figma-design-tokens.json** - Design tokens file compatible with Figma plugins
3. **figma-plugin-generator.js** - Automated Figma plugin script to generate the entire project
4. **This guide** - Step-by-step instructions

---

## 🚀 Quick Start (Recommended Method)

### Option 1: Automated Plugin Generation

This is the **fastest and most comprehensive** method. It will create everything automatically in Figma.

#### Step 1: Create a Figma Plugin

1. Open **Figma Desktop App** (required - web version doesn't support plugins)
2. Create a new Figma file or open an existing one
3. Go to **Plugins → Development → New Plugin...**
4. Choose **"Empty"** template
5. Name it: `EventFlow Generator`
6. Click **Save**

#### Step 2: Add the Generator Code

1. In the plugin creation dialog, note the location where Figma saved the plugin files
2. Open the plugin folder in your code editor
3. **Replace** the entire contents of `code.ts` with the code from `figma-plugin-generator.js`
4. Save the file

#### Step 3: Run the Plugin

1. In Figma, go to **Plugins → Development → EventFlow Generator**
2. The plugin will run and create:
   - ✅ 6 organized pages (Cover, Design System, Components, Screens)
   - ✅ 50+ color styles with proper naming
   - ✅ 11 text styles for typography system
   - ✅ Color palette visualizations
   - ✅ Typography samples
   - ✅ Spacing scale visualizations
   - ✅ Component placeholders
   - ✅ Screen layout templates

3. Wait for completion message: **"✅ EventFlow Design System created!"**

#### Step 4: Review and Customize

1. Navigate through the created pages in the left sidebar
2. The **Design System** page contains all tokens visualized
3. The **Components** page has sections ready for component building
4. The **Screens** pages have layout templates

---

## 🎨 Option 2: Manual Setup with Design Tokens

If you prefer manual control or want to integrate with your existing Figma files.

### Step 1: Install Tokens Studio Plugin

1. In Figma, go to **Plugins → Browse plugins in Community**
2. Search for **"Tokens Studio for Figma"** (formerly Figma Tokens)
3. Click **Install**

### Step 2: Import Design Tokens

1. Open your Figma file
2. Run **Plugins → Tokens Studio for Figma**
3. In the plugin panel, click the **Settings** icon (gear)
4. Click **Import** → **Load from file**
5. Select `figma-design-tokens.json`
6. Click **Import**

### Step 3: Apply Tokens

The plugin will create:
- Color variables for all status colors, semantic colors, and map colors
- Typography tokens (fonts, sizes, line heights, weights)
- Spacing tokens (xs, sm, md, lg, xl)
- Border radius tokens
- Shadow tokens
- Sizing tokens (header height, sidebar widths, etc.)

### Step 4: Sync to Figma Styles

1. In Tokens Studio, go to the **Settings** tab
2. Click **Create Styles** button
3. This will convert all tokens to native Figma color/text styles

---

## 📐 Manual Component Building Guide

If you want to build components manually using the spec:

### Color Styles

Create these color styles manually:

**Status Colors:**
- `Status/Planned` - #3B82F6
- `Status/Active` - #F59E0B
- `Status/Pending Review` - #F97316
- `Status/Closed` - #6B7280
- `Status/Archived` - #374151
- `Status/Cancelled` - #EF4444

**Primary Blue Scale (0-9):**
- Blue 0: #e7f5ff
- Blue 1: #d0ebff
- Blue 2: #a5d8ff
- ... (see figma-design-tokens.json for complete list)

### Text Styles

Create these text styles:

**Headings:**
- H1: 34px / 1.3 line height / Bold (700)
- H2: 26px / 1.35 line height / Bold (700)
- H3: 22px / 1.4 line height / Bold (700)
- H4: 18px / 1.45 line height / Bold (700)
- H5: 16px / 1.5 line height / Bold (700)
- H6: 14px / 1.5 line height / Bold (700)

**Body Text:**
- XS: 12px / 1.4 line height / Regular (400)
- SM: 14px / 1.45 line height / Regular (400)
- MD: 16px / 1.55 line height / Regular (400)
- LG: 18px / 1.6 line height / Regular (400)
- XL: 20px / 1.65 line height / Regular (400)

### Component Structure

Reference `figma-design-spec.md` Section 3 for detailed component specs:

1. **Buttons** - Heights: xs 30px, sm 36px, md 42px, lg 50px, xl 60px
2. **Input Fields** - Default size sm (36px), border radius 4px
3. **Cards** - Padding sm (12px), radius sm (4px), border 1px
4. **Badges** - Size sm/md, various color variants
5. **Sidebars** - Left: 280-600px (default 400px), Right: 400px
6. **Modals** - Various sizes, centered, with overlay

---

## 📱 Screen Layout Templates

### Desktop Layout (≥768px)

**Screen 1: Events Tab - Default View**
```
┌─────────────────────────────────────────────┐
│ Header (60px)                               │
├──────────┬──────────────────────────────────┤
│          │                                  │
│  Left    │                                  │
│ Sidebar  │         Map Area                 │
│ (400px)  │      (MapLibre GL JS)            │
│          │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Screen 2: Events Tab - Event Selected**
```
┌─────────────────────────────────────────────┐
│ Header (60px)                               │
├──────────┬────────────────────┬─────────────┤
│          │                    │             │
│  Left    │                    │   Right     │
│ Sidebar  │    Map Area        │  Sidebar    │
│ (400px)  │  (MapLibre GL JS)  │  (400px)    │
│          │                    │             │
│          │                    │             │
└──────────┴────────────────────┴─────────────┘
```

### Mobile Layout (<768px)

- Single column, full-width map
- Sidebars collapse to drawers (burger menu)
- Touch targets minimum 44px

---

## ✅ Verification Checklist

After setup, verify:

- [ ] All color styles created and match hex values in spec
- [ ] All text styles created with correct sizes and line heights
- [ ] Spacing scale defined (10, 12, 16, 20, 32px)
- [ ] Border radius scale defined (2, 4, 8, 16, 32px)
- [ ] Shadow styles created
- [ ] Component library organized by category
- [ ] Screen layouts match specifications
- [ ] Responsive breakpoint at 768px documented

---

## 🛠️ Troubleshooting

### Plugin doesn't appear in menu
- Make sure you're using Figma Desktop App (not web)
- Check that the plugin was saved correctly
- Try restarting Figma

### "Cannot find module" error in plugin
- The plugin code uses TypeScript syntax
- Figma should automatically compile it
- Make sure you're editing `code.ts` not `code.js`

### Tokens Studio import fails
- Verify the JSON file is valid (use JSONLint)
- Make sure you selected the correct file
- Try importing a smaller subset first

### Colors don't match
- Double-check hex values against `figma-design-tokens.json`
- Ensure color mode is RGB, not HSL
- Verify opacity is set to 100%

---

## 📚 Additional Resources

- **Mantine UI Documentation**: https://mantine.dev/
- **Tabler Icons**: https://tabler.io/icons
- **Figma Plugin API**: https://www.figma.com/plugin-docs/
- **Tokens Studio**: https://tokens.studio/

---

## 🎯 Next Steps

After creating the Figma project:

1. **Build Components**: Use the spec to build each component with exact measurements
2. **Create Variants**: Add states (default, hover, active, disabled) to components
3. **Screen Mockups**: Create high-fidelity mockups of all 7 main screens
4. **Prototype**: Add interactions and flows between screens
5. **Handoff**: Use Figma's Dev Mode for developer handoff

---

## 💡 Tips

- **Use Auto Layout**: Figma's Auto Layout matches the component behavior perfectly
- **Component Properties**: Create variants for different sizes and states
- **Local Styles**: Keep color/text styles local to the file for easier sharing
- **Variables**: Consider using Figma Variables (beta) for even better token management
- **Naming Convention**: Follow the "Category/Item" naming structure for organization

---

## 📞 Support

If you encounter issues or need clarification:
1. Review the detailed spec in `figma-design-spec.md`
2. Check the design tokens in `figma-design-tokens.json`
3. Examine the plugin code in `figma-plugin-generator.js`

Happy designing! 🎨
