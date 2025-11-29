import { z } from 'zod';

// Test enum
const enumSchema = z.enum(['active', 'inactive', 'pending']);
console.log('Enum schema _def:', enumSchema._def);
console.log('Enum values:', enumSchema._def.values);

// Test array
const arraySchema = z.array(z.string());
console.log('\nArray schema _def:', arraySchema._def);
console.log('Array type:', arraySchema._def.type);

// Test description
const descSchema = z.string().describe('Test description');
console.log('\nDescription schema _def:', descSchema._def);
console.log('Description:', descSchema._def.description);
console.log('Schema description property:', descSchema.description);
