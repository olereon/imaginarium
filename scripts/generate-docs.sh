#!/bin/bash

# Imaginarium Documentation Generation Script
# This script generates all documentation for the Imaginarium project

set -e

echo "🎭 Imaginarium Documentation Generator"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps/server" ]; then
    print_error "Please run this script from the root of the Imaginarium project"
    exit 1
fi

# Clean previous documentation
print_status "Cleaning previous documentation..."
rm -rf docs/api docs/storybook docs/api-spec.json

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Build shared libraries
print_status "Building shared libraries..."
npm run build:libs

# Generate TypeDoc API documentation
print_status "Generating TypeDoc API documentation..."
if npx typedoc; then
    print_success "TypeDoc documentation generated successfully"
else
    print_error "Failed to generate TypeDoc documentation"
    exit 1
fi

# Generate OpenAPI specification
print_status "Generating OpenAPI specification..."
if npm run docs:api; then
    print_success "OpenAPI specification generated successfully"
else
    print_warning "Failed to generate OpenAPI specification (dependencies might be missing)"
fi

# Generate Storybook documentation
print_status "Generating Storybook documentation..."
if npm run docs:ui; then
    print_success "Storybook documentation generated successfully"
else
    print_warning "Failed to generate Storybook documentation (check UI library setup)"
fi

# Create documentation index
print_status "Creating documentation index..."
mkdir -p docs/site

cat > docs/site/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Imaginarium Documentation</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 2rem;
            line-height: 1.6;
            background: #f8fafc;
        }
        .header { 
            text-align: center; 
            margin-bottom: 3rem;
            padding: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        .subtitle { color: #64748b; font-size: 1.2rem; }
        .cards { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 2rem; 
        }
        .card { 
            background: white;
            border: 1px solid #e2e8f0; 
            border-radius: 12px; 
            padding: 2rem; 
            text-decoration: none; 
            color: inherit;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card:hover { 
            transform: translateY(-4px); 
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: #3b82f6;
        }
        .card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
        .card h3 { margin: 0 0 1rem 0; color: #1e293b; font-size: 1.25rem; }
        .card p { color: #64748b; margin: 0; }
        .card-meta { 
            margin-top: 1rem; 
            padding-top: 1rem; 
            border-top: 1px solid #e2e8f0;
            font-size: 0.875rem;
            color: #94a3b8;
        }
        .footer { 
            text-align: center; 
            margin-top: 4rem; 
            padding: 2rem;
            color: #64748b;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .footer a { color: #3b82f6; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .status { 
            display: inline-block; 
            padding: 0.25rem 0.75rem; 
            border-radius: 9999px; 
            font-size: 0.75rem; 
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .status-available { background: #dcfce7; color: #166534; }
        .status-partial { background: #fef3c7; color: #92400e; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🎭</div>
        <h1>Imaginarium Documentation</h1>
        <p class="subtitle">AI-powered content generation pipeline automation platform</p>
    </div>
    
    <div class="cards">
        <a href="../api/" class="card">
            <div class="card-icon">📚</div>
            <h3>API Documentation</h3>
            <p>Comprehensive TypeScript API documentation with examples, type definitions, and usage guides for all public interfaces.</p>
            <div class="card-meta">
                <span class="status status-available">Available</span>
                • Generated by TypeDoc
            </div>
        </a>
        
        <a href="../api-spec.json" class="card">
            <div class="card-icon">🔧</div>
            <h3>OpenAPI Specification</h3>
            <p>Machine-readable API specification for integration, testing, and client generation. Compatible with Swagger tools.</p>
            <div class="card-meta">
                <span class="status status-available">Available</span>
                • REST API v1.0
            </div>
        </a>
        
        <a href="../storybook/" class="card">
            <div class="card-icon">🎨</div>
            <h3>UI Component Library</h3>
            <p>Interactive Storybook documentation showcasing React components with live examples and prop controls.</p>
            <div class="card-meta">
                <span class="status status-partial">Partial</span>
                • Component stories
            </div>
        </a>
        
        <a href="../../README.md" class="card">
            <div class="card-icon">🚀</div>
            <h3>Getting Started</h3>
            <p>Quick start guide, installation instructions, and project overview for new developers and contributors.</p>
            <div class="card-meta">
                <span class="status status-available">Available</span>
                • Setup guide
            </div>
        </a>
        
        <a href="../../CONTRIBUTING.md" class="card">
            <div class="card-icon">🤝</div>
            <h3>Contributing Guide</h3>
            <p>Development workflow, coding standards, testing guidelines, and contribution process documentation.</p>
            <div class="card-meta">
                <span class="status status-available">Available</span>
                • Developer guide
            </div>
        </a>
        
        <a href="../ARCHITECTURE.md" class="card">
            <div class="card-icon">🏗️</div>
            <h3>System Architecture</h3>
            <p>Technical architecture overview, design decisions, data flow diagrams, and system documentation.</p>
            <div class="card-meta">
                <span class="status status-available">Available</span>
                • Technical specs
            </div>
        </a>
    </div>
    
    <div class="footer">
        <p><strong>Built with ❤️ by the Imaginarium Team</strong></p>
        <p>
            <a href="https://github.com/your-org/imaginarium">View on GitHub</a> • 
            <a href="https://github.com/your-org/imaginarium/issues">Report Issues</a> • 
            <a href="https://github.com/your-org/imaginarium/discussions">Discussions</a>
        </p>
        <p style="margin-top: 1rem; font-size: 0.875rem;">
            Documentation generated on $(date)
        </p>
    </div>
</body>
</html>
EOF

print_success "Documentation index created"

# Validate generated documentation
print_status "Validating generated documentation..."

validation_errors=0

# Check if API docs were generated
if [ ! -d "docs/api" ]; then
    print_error "API documentation directory not found"
    validation_errors=$((validation_errors + 1))
else
    print_success "API documentation found"
fi

# Check if OpenAPI spec was generated
if [ ! -f "docs/api-spec.json" ]; then
    print_warning "OpenAPI specification not found"
else
    print_success "OpenAPI specification found"
fi

# Validate OpenAPI spec if it exists
if [ -f "docs/api-spec.json" ]; then
    if command -v swagger-parser &> /dev/null; then
        if swagger-parser validate docs/api-spec.json; then
            print_success "OpenAPI specification is valid"
        else
            print_error "OpenAPI specification validation failed"
            validation_errors=$((validation_errors + 1))
        fi
    else
        print_warning "swagger-parser not found, skipping OpenAPI validation"
    fi
fi

# Summary
echo ""
echo "======================================"
if [ $validation_errors -eq 0 ]; then
    print_success "Documentation generated successfully!"
    echo ""
    echo "📍 Documentation locations:"
    echo "   • API docs: docs/api/index.html"
    echo "   • OpenAPI spec: docs/api-spec.json" 
    echo "   • Storybook: docs/storybook/index.html"
    echo "   • Portal: docs/site/index.html"
    echo ""
    echo "🌐 To serve locally:"
    echo "   npx serve docs/site"
else
    print_error "Documentation generation completed with $validation_errors error(s)"
    exit 1
fi