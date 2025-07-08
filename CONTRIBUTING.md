# Contributing to Imaginarium

Thank you for your interest in contributing to Imaginarium! This guide will help you get started with development and ensure your contributions align with our project standards.

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** with proper configuration
- **Docker** (optional, for containerized development)
- **VS Code** (recommended, with workspace extensions)

### Development Setup

1. **Fork and Clone**
   ```bash
   git fork https://github.com/your-org/imaginarium.git
   git clone https://github.com/your-username/imaginarium.git
   cd imaginarium
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build Shared Libraries**
   ```bash
   npm run build:libs
   ```

4. **Start Development Environment**
   ```bash
   npm run dev
   ```

5. **Verify Setup**
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```

## 📁 Project Structure

Understanding the monorepo structure is crucial for effective contribution:

```
imaginarium/
├── apps/
│   ├── client/          # React frontend application
│   └── server/          # Express backend API
├── packages/
│   └── shared/          # Shared types, schemas, and utilities
├── libs/
│   ├── core/           # Core pipeline engine and business logic
│   └── ui/             # Reusable UI components library
├── configs/            # Shared configuration files
├── docker/             # Docker configurations
├── scripts/            # Development and deployment scripts
└── tests/              # Global test utilities
```

### Package Dependencies

- `apps/client` → `libs/ui` → `packages/shared`
- `apps/server` → `libs/core` → `packages/shared`
- All packages can depend on `packages/shared`

## 🛠️ Development Workflow

### Branch Strategy

We use **Git Flow** with the following branch types:

- `main` - Production releases
- `develop` - Integration branch for features
- `feature/*` - New features and enhancements
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `release/*` - Release preparation

### Creating a Feature Branch

```bash
# Ensure you're on develop and up to date
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/your-feature-name

# Work on your feature...

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Convention

We use **Conventional Commits** for consistent commit messages and automated changelog generation:

```bash
# Format: type(scope): description
git commit -m "feat(client): add pipeline node drag and drop"
git commit -m "fix(server): resolve authentication token refresh"
git commit -m "docs: update API documentation"
git commit -m "test(core): add pipeline validation tests"
git commit -m "refactor(ui): improve button component accessibility"
```

#### Commit Types

- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or modifying tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes

#### Scopes

- `client` - Frontend application
- `server` - Backend API
- `shared` - Shared packages
- `core` - Core library
- `ui` - UI library
- `docker` - Docker configuration
- `ci` - CI/CD pipeline

### Code Quality Standards

#### TypeScript

- **Strict mode** enabled with comprehensive rules
- **No implicit any** - all types must be explicit
- **Unused variables/parameters** are not allowed
- **Consistent naming** conventions (camelCase, PascalCase)

#### Code Style

- **ESLint** configuration enforces consistent style
- **Prettier** handles automatic formatting
- **Import ordering** and organization
- **React hooks** rules for frontend components
- **Accessibility** standards for UI components

#### Pre-commit Hooks

Husky runs the following checks before each commit:

```bash
# Automatically run on commit
npm run lint:fix         # Fix linting issues
npm run format          # Format code with Prettier
npm run typecheck       # Verify TypeScript compilation
npm run test:affected   # Run tests for changed files
```

### Testing Strategy

#### Test Structure

```
package/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx      # Component tests
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── helpers.test.ts      # Unit tests
│   └── integration/
│       └── api.test.ts          # Integration tests
└── vitest.config.ts
```

#### Testing Guidelines

1. **Unit Tests** - Test individual functions and components
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { render, screen } from '@testing-library/react'
   import { Button } from './Button'

   describe('Button', () => {
     it('renders with correct text', () => {
       render(<Button>Click me</Button>)
       expect(screen.getByText('Click me')).toBeInTheDocument()
     })
   })
   ```

2. **Integration Tests** - Test API endpoints and workflows
   ```typescript
   import { describe, it, expect } from 'vitest'
   import request from 'supertest'
   import { app } from '../app'

   describe('POST /api/pipelines', () => {
     it('creates a new pipeline', async () => {
       const response = await request(app)
         .post('/api/pipelines')
         .send({ name: 'Test Pipeline' })
         .expect(201)
       
       expect(response.body.name).toBe('Test Pipeline')
     })
   })
   ```

3. **Component Tests** - Test React components with user interactions
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { render, screen, userEvent } from '@testing-library/react'
   import { PipelineEditor } from './PipelineEditor'

   describe('PipelineEditor', () => {
     it('allows adding nodes to pipeline', async () => {
       const user = userEvent.setup()
       render(<PipelineEditor />)
       
       await user.click(screen.getByText('Add Node'))
       expect(screen.getByText('New Node')).toBeInTheDocument()
     })
   })
   ```

#### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for specific package
npm run test:client
npm run test:server
npm run test:shared
```

### Adding New Features

#### 1. Planning Phase

- Create or review GitHub issue
- Discuss approach in issue comments
- Break down complex features into smaller tasks

#### 2. Implementation Phase

```bash
# Create feature branch
git checkout -b feature/new-pipeline-nodes

# If adding a new package
mkdir libs/new-package
cd libs/new-package
npm init -y
# Configure package.json, tsconfig.json, etc.

# If modifying existing package
cd apps/client
# Make your changes
```

#### 3. Documentation Phase

- Update relevant README files
- Add JSDoc comments for public APIs
- Update API documentation if backend changes
- Add Storybook stories for new UI components

#### 4. Testing Phase

- Write comprehensive tests
- Ensure all existing tests pass
- Verify type checking passes
- Test in both development and production builds

### Working with Workspaces

#### Adding Dependencies

```bash
# Add to specific workspace
npm install lodash --workspace=apps/client
npm install -D @types/lodash --workspace=apps/client

# Add to root (dev dependencies)
npm install -D new-tool

# Add to all workspaces
npm install shared-utility --workspaces
```

#### Cross-Package Imports

```typescript
// In apps/client
import { Button } from '@imaginarium/ui'
import { PipelineSchema } from '@imaginarium/shared'
import { PipelineEngine } from '@imaginarium/core'

// In apps/server
import { validatePipeline } from '@imaginarium/core'
import { PipelineInput } from '@imaginarium/shared'
```

#### Building Packages

```bash
# Build all packages
npm run build

# Build specific packages
npm run build:libs      # Build libraries first
npm run build:apps      # Build applications

# Watch mode for development
npm run build:watch
```

## 🔍 Code Review Process

### Pull Request Guidelines

1. **Title**: Use conventional commit format
   ```
   feat(client): add real-time pipeline collaboration
   ```

2. **Description**: Include
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
   - Screenshots for UI changes

3. **Checklist**:
   - [ ] Tests pass locally
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Breaking changes documented

### Review Criteria

**Code Quality**
- TypeScript types are accurate and comprehensive
- Error handling is appropriate
- Code is readable and well-commented
- Performance considerations addressed

**Testing**
- Adequate test coverage for new code
- Tests are meaningful and test behavior, not implementation
- Edge cases are covered

**Documentation**
- Public APIs are documented
- README files updated if necessary
- Breaking changes clearly documented

**Security**
- No sensitive data exposed
- Input validation implemented
- Authentication/authorization proper

### Reviewer Guidelines

- Be constructive and respectful
- Explain the "why" behind suggestions
- Approve when code meets standards
- Request changes for blocking issues
- Use suggestion feature for minor fixes

## 🚀 Release Process

### Semantic Versioning

We use semantic versioning (semver) with automated releases:

- **MAJOR** version: Breaking changes
- **MINOR** version: New features (backward compatible)
- **PATCH** version: Bug fixes (backward compatible)

### Release Workflow

1. **Feature Development** on feature branches
2. **Integration** via pull requests to `develop`
3. **Release Preparation** via `release/*` branch
4. **Production Release** via merge to `main`
5. **Automated Deployment** via GitHub Actions

### Manual Release

```bash
# Create release branch
git checkout -b release/1.2.0

# Update version in package.json files
npm version minor

# Create release PR to main
# After merge, tag is automatically created
```

## 🐛 Bug Reports and Feature Requests

### Bug Reports

Include:
- **Description** of the issue
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Environment** (OS, Node version, browser)
- **Screenshots** if applicable

### Feature Requests

Include:
- **User story** ("As a user, I want...")
- **Use case** description
- **Acceptance criteria**
- **Technical considerations**
- **Mockups** if applicable

## 💡 Development Tips

### VS Code Extensions

Recommended extensions for optimal development experience:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-jest",
    "usernamehw.errorlens"
  ]
}
```

### Debugging

#### Frontend Debugging
- Use React Developer Tools
- Browser DevTools with source maps
- Vite's fast refresh for quick iteration

#### Backend Debugging
- Use VS Code debugger with tsx
- Winston logging at appropriate levels
- Database query logging in development

### Performance

#### Frontend
- Use React.memo for expensive components
- Implement proper key props for lists
- Lazy load routes and components
- Optimize bundle size with code splitting

#### Backend
- Use database indexes appropriately
- Implement request rate limiting
- Use Redis for caching frequently accessed data
- Monitor API response times

### Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs
- Implement proper CORS policies
- Use HTTPS in production

## 📞 Getting Help

- **GitHub Issues** - Report bugs and request features
- **GitHub Discussions** - Ask questions and share ideas
- **Code Reviews** - Request feedback on implementation
- **Documentation** - Check README and inline docs first

## 🏆 Recognition

Contributors will be recognized in:
- CHANGELOG.md for each release
- GitHub contributors page
- README.md acknowledgments section

Thank you for contributing to Imaginarium! 🎭