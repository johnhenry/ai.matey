# window.ai API Documentation

This document provides comprehensive documentation for the window.ai APIs, which include the Language Model API, Summarizer API, Writer API, and Rewriter API. Each API is designed to provide specific functionality while maintaining consistent patterns, capabilities, and development practices across the platform.

## Table of Contents

1. [Language Model API (window.ai.languageModel)](api/language-model.md)
2. [Summarizer API (window.ai.summarizer)](api/summarizer.md)
3. [Writer API (window.ai.writer)](api/writer.md)
4. [Rewriter API (window.ai.rewriter)](api/rewriter.md)

## Add Support to Localhost

To access the Language Model API on localhost during the origin trial:

1. Update Chrome to the latest version
2. Open Chrome on Windows, Mac, or Linux
3. Go to `chrome://flags/#optimization-guide-on-device-model`
4. Select `Enabled BypassPerfRequirement`
5. Click Relaunch or restart Chrome
6. Visit `chrome://components` and check for updates to the `Optimization Guide` component

## Implementation Notes

All APIs in the window.ai platform share these characteristics:

- Support for capability checking before use
- Consistent error handling patterns
- Both synchronous and streaming output options
- Abort signal support for cancellation
- Context preservation where appropriate
- Session management (creation, cloning, destroying) to handle resources effectively

### Privacy and Security

- All APIs support local processing for sensitive data
- No guarantee of data privacy unless explicitly specified
- Implementation-specific security measures apply
- Potential fingerprinting considerations through capabilities APIs

### Performance Considerations

- Local processing provides faster results
- Streaming support for long-form content
- Resource management through session handling
- Automatic cleanup of unused resources

### Best Practices

1. Always check capabilities before creating instances
2. Use streaming for long-form content
3. Properly handle errors and aborts
4. Clean up resources when done
5. Provide clear context for better results
