# Jira AI Web Application

A web application that generates AI-powered stories and creates issues in both Jira and GitHub.

## Features

- **AI Story Generation**: Uses Azure OpenAI to generate detailed user stories with acceptance criteria
- **Multi-Platform Issue Creation**: Create issues in both Jira and GitHub from a single interface
- **Flexible Platform Selection**: Choose to create issues in Jira only, GitHub only, or both platforms simultaneously

## Setup

### Prerequisites

1. Node.js and npm installed
2. Azure OpenAI API access
3. Jira API token (if using Jira integration)
4. GitHub Personal Access Token (if using GitHub integration)

### Installation

1. Install backend dependencies:
   ```bash
   npm install express cors dotenv
   ```

2. Start the backend proxy server:
   ```bash
   node backend-proxy.js
   ```

3. Open `index.html` in your web browser

## Configuration

### Azure OpenAI
- Add your Azure API Key in the Settings panel (hamburger menu top-left)

### Jira Integration
- Generate a Jira API token from [Jira Profile Settings](https://jira.cvent.com/secure/ViewProfile.jspa)
- Add the token in the Settings panel

### GitHub Integration
- Generate a Personal Access Token from [GitHub Settings](https://github.com/settings/tokens)
- Ensure the token has `repo` permissions to create issues
- Add the token and repository (format: `owner/repo`) in the Settings panel

## Usage

1. **Generate Story**: Enter a task description and click "Generate Story"
2. **Select Platforms**: Choose whether to create issues in Jira, GitHub, or both
3. **Configure Settings**: 
   - For Jira: Set project key, issue type, and labels
   - For GitHub: Set labels (optional)
4. **Create Issues**: Click "Create Issues" to submit to selected platforms

## API Endpoints

The backend proxy provides the following endpoints:

- `POST /api/jira/issue` - Create Jira tickets
- `POST /api/github/issue` - Create GitHub issues

## Security Notes

- API tokens are only stored in browser memory and not persisted
- All API calls go through the local proxy server to handle CORS
- Backend proxy should only be run in secure environments

## Troubleshooting

- Ensure the backend proxy is running on `http://localhost:4000`
- Check that API tokens have the necessary permissions
- Verify repository names are in the correct format (`owner/repo`)
