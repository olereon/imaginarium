# Pipeline Template Fixtures

This directory contains fixture files for common pipeline templates that can be used for development, testing, and as starting points for users.

## Structure

```
fixtures/
├── content-creation-templates.json     # Content creation templates
├── data-analysis-templates.json        # Data analysis templates
├── workflow-automation-templates.json  # Workflow automation templates
├── ai-integration-templates.json       # AI integration templates
├── image-processing-templates.json     # Image processing templates
├── load-fixtures.ts                    # Fixture loader script
├── index.ts                            # Fixture utilities
└── README.md                           # This file
```

## Template Categories

### Content Creation
- **AI Image Generator**: Generate images from text prompts
- **Blog Post Writer**: Create complete blog posts with SEO
- **Social Media Content Creator**: Multi-platform social media posts

### Data Analysis
- **Smart Data Analyzer**: Comprehensive data analysis with visualizations
- **Survey Response Analyzer**: Analyze survey data and customer feedback
- **Financial Data Analyzer**: Financial analysis and investment insights

### Workflow Automation
- **Webhook Event Processor**: Process webhook events with conditional logic
- **Automated Email Campaign**: Send personalized email campaigns
- **Automated File Processor**: Process uploaded files with transformations

### AI Integration
- **Multi-Model AI Comparison**: Compare outputs from multiple AI models
- **Chain of Thought Reasoner**: Step-by-step problem solving
- **Multimodal Content Analyzer**: Analyze text, images, and audio

### Image Processing
- **AI Image Enhancer**: Enhance images with AI upscaling and denoising
- **Batch Image Processor**: Process multiple images with transformations
- **AI Style Transfer**: Apply artistic styles to images

## Usage

### Loading Fixtures

```bash
# Load all fixtures into database
npx tsx prisma/fixtures/load-fixtures.ts load

# Clear all fixture templates
npx tsx prisma/fixtures/load-fixtures.ts clear

# Reload all fixtures (clear and load)
npx tsx prisma/fixtures/load-fixtures.ts reload
```

### Using in Code

```typescript
import { fixtures, loadAllFixtures, getFixtureById } from './prisma/fixtures'

// Get all content creation templates
const contentTemplates = fixtures.contentCreation

// Load all fixtures into database
await loadAllFixtures(prisma)

// Get a specific fixture
const imageGenerator = getFixtureById('template-image-generator')

// Search fixtures
const aiTemplates = searchFixtures('ai')

// Get fixture statistics
const stats = getFixtureStats()
```

## Template Structure

Each template fixture has the following structure:

```typescript
interface TemplateFixture {
  id: string                    // Unique identifier
  name: string                  // Human-readable name
  description: string           // Description of what the template does
  category: string              // Category (content-creation, data-analysis, etc.)
  isPublic: boolean            // Whether template is publicly available
  configuration: {             // Pipeline configuration
    nodes: Node[]              // Pipeline nodes
    connections: Connection[]   // Node connections
  }
  parameters: {                // Template parameters
    [key: string]: {
      type: string             // Parameter type (string, number, boolean, etc.)
      default: any             // Default value
      description: string      // Parameter description
      options?: string[]       // Options for select types
      min?: number            // Minimum value for numbers
      max?: number            // Maximum value for numbers
    }
  }
  usageCount: number           // Number of times used
  tags: string[]               // Tags for categorization
  difficulty: string           // Difficulty level (beginner, intermediate, advanced, expert)
  estimatedTime: string        // Estimated execution time
  cost: string                 // Cost level (low, medium, high)
}
```

## Template Parameters

Templates use parameter placeholders in the format `{{parameterName}}`. These are replaced with actual values when the template is instantiated.

### Parameter Types

- `string`: Text input
- `number`: Numeric input with optional min/max
- `boolean`: True/false checkbox
- `select`: Dropdown with predefined options
- `multiselect`: Multiple selection from options
- `json`: JSON object input

### Example Parameter Definition

```json
{
  "imageSize": {
    "type": "select",
    "options": ["512x512", "1024x1024", "1792x1024"],
    "default": "1024x1024",
    "description": "Output image size"
  },
  "temperature": {
    "type": "number",
    "min": 0,
    "max": 2,
    "default": 0.7,
    "description": "Creativity level (0-2)"
  }
}
```

## Adding New Templates

1. Create or edit the appropriate JSON file in the fixtures directory
2. Add your template following the structure above
3. Use parameter placeholders (`{{param}}`) in the configuration
4. Define parameters with proper types and defaults
5. Run the fixture loader to update the database

## Development Commands

```bash
# Add fixtures to package.json scripts
npm run fixtures:load    # Load fixtures
npm run fixtures:clear   # Clear fixtures  
npm run fixtures:reload  # Reload fixtures
```

## Testing

Templates should be tested to ensure:
- All parameters are properly defined
- Configuration is valid
- Template can be instantiated successfully
- Pipeline executes without errors

## Best Practices

1. **Clear naming**: Use descriptive names and IDs
2. **Good defaults**: Provide sensible default values
3. **Helpful descriptions**: Write clear parameter descriptions
4. **Proper categorization**: Use appropriate categories and tags
5. **Realistic estimates**: Provide accurate time and cost estimates
6. **Public availability**: Mark templates as public when appropriate for sharing

## Maintenance

- Regularly update templates to match current AI models and capabilities
- Add new templates based on user feedback and common use cases
- Keep parameter definitions up to date with pipeline engine changes
- Monitor usage counts to identify popular templates