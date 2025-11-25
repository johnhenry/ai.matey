/**
 * StreamText Component
 *
 * React component for rendering streaming text with typing effect.
 *
 * @module
 */

import { useEffect, useState, useMemo, type ReactNode } from 'react';

/**
 * StreamText props.
 */
export interface StreamTextProps {
  /** Text to display */
  text: string;
  /** Whether streaming is active */
  isStreaming?: boolean;
  /** Show cursor while streaming */
  showCursor?: boolean;
  /** Cursor character */
  cursor?: string;
  /** Cursor blink interval in ms */
  cursorBlinkInterval?: number;
  /** Custom className */
  className?: string;
  /** Custom render function */
  renderText?: (text: string) => ReactNode;
  /** Children to render after text */
  children?: ReactNode;
}

/**
 * StreamText - Display streaming text with optional cursor.
 *
 * @example
 * ```tsx
 * import { StreamText } from 'ai.matey.react.stream';
 *
 * function ChatMessage({ text, isStreaming }) {
 *   return (
 *     <StreamText
 *       text={text}
 *       isStreaming={isStreaming}
 *       showCursor={true}
 *     />
 *   );
 * }
 * ```
 */
export function StreamText({
  text,
  isStreaming = false,
  showCursor = true,
  cursor = '▋',
  cursorBlinkInterval = 500,
  className,
  renderText,
  children,
}: StreamTextProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink cursor while streaming
  useEffect(() => {
    if (!isStreaming || !showCursor) {
      setCursorVisible(false);
      return;
    }

    setCursorVisible(true);

    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, cursorBlinkInterval);

    return () => clearInterval(interval);
  }, [isStreaming, showCursor, cursorBlinkInterval]);

  // Render text content
  const textContent = useMemo(() => {
    if (renderText) {
      return renderText(text);
    }
    return text;
  }, [text, renderText]);

  return (
    <span className={className}>
      {textContent}
      {isStreaming && showCursor && cursorVisible && (
        <span className="streaming-cursor" aria-hidden="true">
          {cursor}
        </span>
      )}
      {children}
    </span>
  );
}

/**
 * TypeWriter props.
 */
export interface TypeWriterProps {
  /** Text to type */
  text: string;
  /** Typing speed in ms per character */
  speed?: number;
  /** Delay before starting in ms */
  delay?: number;
  /** Called when typing completes */
  onComplete?: () => void;
  /** Custom className */
  className?: string;
  /** Show cursor */
  showCursor?: boolean;
  /** Cursor character */
  cursor?: string;
}

/**
 * TypeWriter - Display text with typewriter effect.
 *
 * Simulates typing effect for non-streaming text.
 *
 * @example
 * ```tsx
 * import { TypeWriter } from 'ai.matey.react.stream';
 *
 * function WelcomeMessage() {
 *   return (
 *     <TypeWriter
 *       text="Welcome to AI Matey!"
 *       speed={50}
 *       onComplete={() => console.log('Done typing')}
 *     />
 *   );
 * }
 * ```
 */
export function TypeWriter({
  text,
  speed = 30,
  delay = 0,
  onComplete,
  className,
  showCursor = true,
  cursor = '▋',
}: TypeWriterProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(false);

    if (!text) return;

    // Start delay
    const delayTimeout = setTimeout(() => {
      setIsTyping(true);
      let currentIndex = 0;

      const typeInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(typeInterval);
    }, delay);

    return () => clearTimeout(delayTimeout);
  }, [text, speed, delay, onComplete]);

  return (
    <StreamText
      text={displayedText}
      isStreaming={isTyping}
      showCursor={showCursor}
      cursor={cursor}
      className={className}
    />
  );
}
