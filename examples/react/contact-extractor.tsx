/**
 * Contact Information Extractor with useObject
 *
 * Demonstrates useObject for extracting structured data from unstructured text.
 *
 * Setup:
 * ```bash
 * npm install react react-dom zod
 * npm install ai.matey
 * ```
 *
 * This example shows:
 * - Data extraction from unstructured text
 * - Schema validation for structured outputs
 * - Progressive rendering of extracted fields
 * - Form generation from AI-extracted data
 */

import React, { useState } from 'react';
import { useObject } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
import { z } from 'zod';

// Define contact schema
const contactSchema = z.object({
  name: z.string().describe('Full name of the person'),
  email: z.string().email().optional().describe('Email address'),
  phone: z.string().optional().describe('Phone number'),
  company: z.string().optional().describe('Company name'),
  title: z.string().optional().describe('Job title'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional().describe('Mailing address'),
  socialMedia: z.object({
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    github: z.string().optional(),
  }).optional().describe('Social media profiles'),
  notes: z.string().optional().describe('Additional notes or context'),
});

type Contact = z.infer<typeof contactSchema>;

export default function ContactExtractor() {
  const [inputText, setInputText] = useState('');
  const [extractedContact, setExtractedContact] = useState<Contact | null>(null);

  // Example texts
  const exampleTexts = [
    `Hi, I'm Sarah Johnson, a Software Engineer at TechCorp Inc.
You can reach me at sarah.j@techcorp.com or call me at (555) 123-4567.
My office is located at 123 Tech Street, San Francisco, CA 94105.
Find me on LinkedIn: linkedin.com/in/sarahjohnson`,

    `Contact: Dr. Michael Chen
Position: Chief Technology Officer
Organization: InnovateLabs
Email: m.chen@innovatelabs.io
Mobile: +1-555-987-6543
Twitter: @michaelchen_cto
GitHub: github.com/mchen`,

    `Jane Smith - jane.smith@email.com - Marketing Director at Global Solutions
Office: 456 Business Ave, New York, NY 10001 | Phone: 555-0199`,
  ];

  // Create backend adapter
  const backend = React.useMemo(() => {
    return createOpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }, []);

  // Initialize useObject hook
  const {
    object: contact,
    submit,
    isLoading,
    error,
    stop,
  } = useObject<Contact>({
    backend,
    model: 'gpt-4',
    schema: contactSchema,
    temperature: 0.1, // Low temperature for accurate extraction
    onFinish: (contact) => {
      console.log('Contact extracted:', contact);
      setExtractedContact(contact);
    },
  });

  const handleExtract = () => {
    if (inputText.trim()) {
      submit(`Extract contact information from the following text:\n\n${inputText}`);
    }
  };

  const loadExample = (text: string) => {
    setInputText(text);
  };

  const saveContact = () => {
    if (extractedContact) {
      // In a real app, this would save to a database or export as vCard
      console.log('Saving contact:', extractedContact);
      alert('Contact saved! (Check console for details)');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1>📇 AI Contact Extractor</h1>
        <p style={{ color: '#666' }}>
          Extract structured contact information from any text
        </p>
      </header>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00',
        }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Input panel */}
        <div>
          <h3 style={{ marginBottom: '12px' }}>Input Text</h3>

          {/* Example buttons */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Load example:
            </div>
            {exampleTexts.map((_, i) => (
              <button
                key={i}
                onClick={() => loadExample(exampleTexts[i])}
                disabled={isLoading}
                style={{
                  padding: '6px 12px',
                  marginRight: '8px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                Example {i + 1}
              </button>
            ))}
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste any text containing contact information (emails, signatures, business cards, etc.)"
            disabled={isLoading}
            rows={12}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              resize: 'vertical',
              marginBottom: '12px',
            }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            {isLoading ? (
              <button
                onClick={stop}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                ⏹ Stop
              </button>
            ) : (
              <button
                onClick={handleExtract}
                disabled={!inputText.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: inputText.trim() ? '#2196f3' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                🔍 Extract Contact
              </button>
            )}
          </div>
        </div>

        {/* Output panel */}
        <div>
          <h3 style={{ marginBottom: '12px' }}>Extracted Contact</h3>

          <div style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            minHeight: '400px',
            backgroundColor: '#fafafa',
          }}>
            {!contact && !isLoading && (
              <p style={{ color: '#999', textAlign: 'center', marginTop: '100px' }}>
                No contact extracted yet
              </p>
            )}

            {isLoading && (
              <div style={{ textAlign: 'center', marginTop: '100px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                  Extracting contact information...
                </div>
                <div style={{
                  display: 'inline-block',
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e0e0e0',
                  borderTopColor: '#2196f3',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {contact && (
              <div>
                {/* Name */}
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ margin: '0 0 4px 0', color: '#333' }}>
                    {contact.name || 'Unknown Name'}
                  </h2>
                  {contact.title && (
                    <div style={{ color: '#666', fontSize: '15px' }}>
                      {contact.title}
                      {contact.company && ` at ${contact.company}`}
                    </div>
                  )}
                </div>

                {/* Contact details */}
                <div style={{ marginBottom: '20px' }}>
                  {contact.email && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>📧 Email:</strong>{' '}
                      <a href={`mailto:${contact.email}`} style={{ color: '#2196f3' }}>
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>📞 Phone:</strong> {contact.phone}
                    </div>
                  )}
                </div>

                {/* Address */}
                {contact.address && Object.values(contact.address).some(v => v) && (
                  <div style={{ marginBottom: '20px' }}>
                    <strong>📍 Address:</strong>
                    <div style={{ marginTop: '4px', color: '#666', lineHeight: '1.6' }}>
                      {contact.address.street && <div>{contact.address.street}</div>}
                      {(contact.address.city || contact.address.state || contact.address.zip) && (
                        <div>
                          {[contact.address.city, contact.address.state, contact.address.zip]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                      {contact.address.country && <div>{contact.address.country}</div>}
                    </div>
                  </div>
                )}

                {/* Social media */}
                {contact.socialMedia && Object.values(contact.socialMedia).some(v => v) && (
                  <div style={{ marginBottom: '20px' }}>
                    <strong>🔗 Social Media:</strong>
                    <div style={{ marginTop: '8px' }}>
                      {contact.socialMedia.linkedin && (
                        <div style={{ marginBottom: '4px' }}>
                          <a href={`https://${contact.socialMedia.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5' }}>
                            LinkedIn
                          </a>
                        </div>
                      )}
                      {contact.socialMedia.twitter && (
                        <div style={{ marginBottom: '4px' }}>
                          <a href={`https://twitter.com/${contact.socialMedia.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1da1f2' }}>
                            Twitter
                          </a>
                        </div>
                      )}
                      {contact.socialMedia.github && (
                        <div style={{ marginBottom: '4px' }}>
                          <a href={`https://${contact.socialMedia.github}`} target="_blank" rel="noopener noreferrer" style={{ color: '#333' }}>
                            GitHub
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {contact.notes && (
                  <div style={{ marginBottom: '20px' }}>
                    <strong>📝 Notes:</strong>
                    <div style={{ marginTop: '4px', color: '#666', fontStyle: 'italic' }}>
                      {contact.notes}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #ddd' }}>
                  <button
                    onClick={saveContact}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      marginRight: '10px',
                    }}
                  >
                    💾 Save Contact
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(contact, null, 2));
                      alert('Contact JSON copied to clipboard!');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    📋 Copy JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schema info */}
      <div style={{
        marginTop: '30px',
        padding: '16px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#1565c0',
      }}>
        <strong>💡 How it works:</strong> This example uses the useObject hook with a Zod schema
        to extract structured contact information from unstructured text. The AI progressively
        builds the contact object as it streams, and Zod validates the final result.
      </div>
    </div>
  );
}
