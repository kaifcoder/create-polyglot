# Automated Release Notes System

This document explains how the automated release notes generation system works in the create-polyglot project and how contributors can help improve it.

## Overview

The create-polyglot project uses an automated system to generate comprehensive release notes when new versions are published. This system categorizes changes, generates structured notes, and helps maintain consistency across releases.

## How It Works

### 1. Triggering Release Notes Generation

Release notes are automatically generated in the following scenarios:

- **Automatic**: When a new GitHub release is created
- **Manual**: By running the "Generate Release Notes" workflow manually
- **Integrated**: As part of the npm publish workflow

### 2. Categorization Logic

The system analyzes commit messages and categorizes them into the following sections:

#### 🚀 Features Added
- Commits starting with `feat:` or `feat(scope):`
- Commits containing words like "add", "implement"
- New functionality for users

#### 🐛 Bug Fixes  
- Commits starting with `fix:` or `fix(scope):`
- Commits containing words like "bug", "patch"
- Fixes that resolve issues for users

#### ⚠️ Breaking Changes
- Commits starting with `feat!:` or `fix!:`
- Commits containing the word "breaking"
- Changes that break backward compatibility

#### 📚 Documentation
- Commits starting with `docs:` or `docs(scope):`
- Commits containing "documentation", "readme"
- Documentation-only changes

#### 🔧 Internal/DevOps
- Commits starting with `chore:`, `ci:`, `test:`, `refactor:`
- Internal changes that don't affect users

#### 📦 Dependencies
- Commits starting with `deps:`
- Commits containing "dependencies", "package", "bump"
- Dependency updates

#### 🎉 Other Changes
- Any commits that don't fit the above categories

### 3. Generated Content

Each release note includes:

- **Categorized change lists** with commit links and authors
- **Contributors section** with all contributors for the release
- **Installation instructions** for the new version
- **Comparison links** to view all changes
- **Placeholders** for manual additions (upgrade notes, known issues)

## Contributing to Better Release Notes

### For Contributors

#### 1. Use Conventional Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Good examples
feat: add Kong API gateway integration
fix: resolve port collision in service detection  
docs: update README with new CLI commands
feat!: change default service structure (breaking)
chore: update dependencies to latest versions

# Less ideal
Added gateway support
Fixed bug
Updated docs
```

#### 2. Use Descriptive Commit Messages

- Write commit messages that explain **what** changed from a user's perspective
- Include the scope when relevant: `feat(cli): add --kong flag`
- Be specific: instead of "fix bug", write "fix port collision in service detection"

#### 3. Fill Out PR Templates

When creating pull requests:
- Select the appropriate **Type of Change**
- Mark whether it's a **User-facing change** or **Internal change only**
- Provide **Breaking Changes & Migration** details if applicable
- Write clear descriptions that will help with release notes

#### 4. Tag Breaking Changes Properly

For breaking changes:
- Use `!` in the commit type: `feat!:` or `fix!:`
- Include "BREAKING CHANGE:" in the commit body
- Provide migration steps in the PR description

### For Maintainers

#### 1. Manual Release Notes Enhancement

After automatic generation, maintainers can enhance the release notes by:

- Adding upgrade notes and migration steps
- Including known issues or caveats  
- Highlighting particularly important changes
- Adding usage examples for new features

#### 2. Using Manual Workflow Dispatch

To generate release notes for testing or drafts:

1. Go to Actions → "Generate Release Notes"
2. Click "Run workflow"
3. Enter the tag name (e.g., `v1.17.0`)
4. Optionally specify target branch
5. Review the generated draft release

#### 3. Customizing Templates

The release notes template can be customized by editing:
- `.github/release-notes-template.md` - Main template structure
- `.github/workflows/release-notes.yml` - Categorization logic

## System Architecture

### Files Involved

- `.github/release-notes-template.md` - Template for release notes structure
- `.github/workflows/release-notes.yml` - Main release notes generation workflow  
- `.github/workflows/npm-publish.yml` - Integration with npm publishing
- `.github/pull_request_template.md` - Enhanced PR template for categorization

### Workflow Process

1. **Trigger**: Release created or manual dispatch
2. **Analysis**: Analyze commits since last release
3. **Categorization**: Sort commits by type using regex patterns
4. **Generation**: Apply categorized content to template
5. **Publishing**: Update release with generated notes
6. **Artifacts**: Save generated notes as workflow artifacts

## Customization Options

### Adding New Categories

To add a new category:

1. Update the template in `.github/release-notes-template.md`
2. Add categorization logic in `.github/workflows/release-notes.yml`
3. Update the PR template if needed

### Modifying Categorization Rules

Edit the regex patterns in the workflow file:

```bash
# Example: Adding new patterns for API changes
if [[ $lower_subject =~ ^api(\(.*\))?: ]] || [[ $lower_subject =~ api.change ]]; then
  api_changes+=("- $subject ([${hash}](https://github.com/${{ github.repository }}/commit/${hash})) by @${author}")
fi
```

### Custom Template Variables

Add new template variables by:

1. Defining them in the template: `{custom_section}`
2. Generating content in the workflow
3. Replacing them in the generation step: `NOTES="${NOTES//\{custom_section\}/$CUSTOM_CONTENT}"`

## Best Practices

### For Contributors

- **Be consistent** with commit message formats
- **Think about users** when writing commit messages
- **Use scopes** to provide context: `feat(cli):`, `fix(docker):`
- **Document breaking changes** thoroughly

### For Maintainers

- **Review generated notes** before publishing
- **Add context** that automated systems can't provide
- **Update templates** based on feedback and project evolution
- **Test the system** with manual dispatches before releases

## Troubleshooting

### Common Issues

1. **Missing commits in release notes**
   - Check if commits follow conventional format
   - Verify the previous tag detection logic
   - Ensure commits are not merge commits (they're filtered out)

2. **Incorrect categorization**
   - Review the regex patterns in the workflow
   - Consider updating commit message to be more specific
   - Check for typos in commit prefixes

3. **Workflow failures**
   - Check GitHub Actions logs
   - Verify template syntax
   - Ensure proper permissions are set

### Testing Changes

To test changes to the release notes system:

1. Create a test tag: `git tag v0.0.0-test`
2. Push the tag: `git push origin v0.0.0-test`
3. Manually run the workflow with the test tag
4. Review generated output
5. Delete test tag when done: `git tag -d v0.0.0-test && git push origin :refs/tags/v0.0.0-test`

## Future Enhancements

Potential improvements to consider:

- **PR-based categorization**: Use PR labels instead of just commit messages
- **Automated breaking change detection**: Analyze code changes for potential breaking changes
- **Integration with issue tracking**: Link resolved issues in release notes
- **Multi-language support**: Generate release notes in multiple languages
- **Enhanced templates**: More sophisticated templating with conditionals

## Support

If you encounter issues with the automated release notes system:

1. Check the [workflow runs](../../actions/workflows/release-notes.yml) for error details
2. Review this documentation for best practices
3. Open an issue with the `documentation` or `ci` label
4. Contact maintainers in the repository discussions
## Recent Updates

- Added refactoring and performance section to release notes
- Enhanced categorization for code quality improvements
