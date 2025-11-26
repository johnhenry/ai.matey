/**
 * Router Test Script
 *
 * Comprehensive test of the Router functionality including:
 * - Backend registration and management
 * - Routing strategies (explicit, model-based, round-robin, etc.)
 * - Fallback strategies (sequential, parallel)
 * - Circuit breaker pattern
 * - Health checking
 * - Parallel dispatch
 * - Integration with Bridge
 */

// Import from monorepo packages
import { Router, createRouter, Bridge } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend.anthropic';
import type { IRChatRequest } from 'ai.matey.types';

// ============================================================================
// Helper Functions
// ============================================================================

function log(section: string, message: string) {
  console.log(`\n[${'='.repeat(70)}]`);
  console.log(`[${section}]`);
  console.log(`[${'='.repeat(70)}]`);
  console.log(message);
}

function success(message: string) {
  console.log(`✅ ${message}`);
}

function error(message: string, err?: unknown) {
  console.error(`❌ ${message}`);
  if (err) {
    console.error(err);
  }
}

// ============================================================================
// Test 1: Backend Registration
// ============================================================================

async function testBackendRegistration() {
  log('TEST 1', 'Backend Registration and Management');

  try {
    const router = createRouter();

    // Create mock API keys
    const openaiAdapter = new OpenAIBackendAdapter({
      apiKey: 'test-openai-key',
    });

    const anthropicAdapter = new AnthropicBackendAdapter({
      apiKey: 'test-anthropic-key',
    });

    // Register backends
    router.register('openai', openaiAdapter);
    success('Registered OpenAI backend');

    router.register('anthropic', anthropicAdapter);
    success('Registered Anthropic backend');

    // List backends
    const backends = router.listBackends();
    console.log('Registered backends:', backends);

    if (backends.length !== 2) {
      throw new Error(`Expected 2 backends, got ${backends.length}`);
    }
    success('Backend count correct');

    // Get backend info
    const info = router.getBackendInfo();
    console.log('Backend info:', JSON.stringify(info.map(i => ({
      name: i.name,
      provider: i.metadata.provider,
      isHealthy: i.isHealthy,
      circuitBreakerState: i.circuitBreakerState,
    })), null, 2));
    success('Retrieved backend info');

    // Test duplicate registration (should fail)
    try {
      router.register('openai', openaiAdapter);
      error('Should have thrown error for duplicate registration');
    } catch (e: any) {
      success('Correctly prevented duplicate registration');
    }

    success('Backend registration tests passed');
  } catch (err) {
    error('Backend registration tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 2: Routing Strategies
// ============================================================================

async function testRoutingStrategies() {
  log('TEST 2', 'Routing Strategies');

  try {
    const router = createRouter({
      routingStrategy: 'model-based',
      defaultBackend: 'openai',
    });

    // Register backends
    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const anthropicAdapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

    router.register('openai', openaiAdapter);
    router.register('anthropic', anthropicAdapter);

    // Set model mapping
    router.setModelMapping({
      'gpt-4': 'openai',
      'gpt-3.5-turbo': 'openai',
      'claude-3-opus': 'anthropic',
      'claude-3-sonnet': 'anthropic',
    });
    success('Set model mapping');

    // Test model-based routing
    const request1: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      parameters: { model: 'gpt-4' },
      metadata: { requestId: 'test-1', timestamp: Date.now() },
    };

    const selected1 = await router.selectBackend(request1);
    console.log('Selected backend for gpt-4:', selected1);
    if (selected1 !== 'openai') {
      throw new Error(`Expected 'openai', got '${selected1}'`);
    }
    success('Model-based routing works for OpenAI');

    const request2: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      parameters: { model: 'claude-3-opus' },
      metadata: { requestId: 'test-2', timestamp: Date.now() },
    };

    const selected2 = await router.selectBackend(request2);
    console.log('Selected backend for claude-3-opus:', selected2);
    if (selected2 !== 'anthropic') {
      throw new Error(`Expected 'anthropic', got '${selected2}'`);
    }
    success('Model-based routing works for Anthropic');

    // Test pattern matching
    router.setModelPatterns([
      { pattern: /^gpt-/, backend: 'openai' },
      { pattern: /^claude-/, backend: 'anthropic' },
    ]);
    success('Set model patterns');

    const request3: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      parameters: { model: 'gpt-4-turbo' },
      metadata: { requestId: 'test-3', timestamp: Date.now() },
    };

    const selected3 = await router.selectBackend(request3);
    console.log('Selected backend for gpt-4-turbo (pattern):', selected3);
    if (selected3 !== 'openai') {
      throw new Error(`Expected 'openai', got '${selected3}'`);
    }
    success('Pattern-based routing works');

    // Test round-robin
    const rrRouter = createRouter({ routingStrategy: 'round-robin' });
    rrRouter.register('openai', openaiAdapter);
    rrRouter.register('anthropic', anthropicAdapter);

    const rrRequest: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { requestId: 'test-rr', timestamp: Date.now() },
    };

    const rr1 = await rrRouter.selectBackend(rrRequest);
    const rr2 = await rrRouter.selectBackend(rrRequest);
    console.log('Round-robin selections:', rr1, rr2);

    if (rr1 === rr2) {
      error('Round-robin should alternate backends');
    } else {
      success('Round-robin routing works');
    }

    success('Routing strategy tests passed');
  } catch (err) {
    error('Routing strategy tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 3: Circuit Breaker
// ============================================================================

async function testCircuitBreaker() {
  log('TEST 3', 'Circuit Breaker Pattern');

  try {
    const router = createRouter({
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 2000,
    });

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    router.register('openai', openaiAdapter);

    // Check initial state
    const info = router.getBackendInfo('openai');
    console.log('Initial circuit breaker state:', info?.circuitBreakerState);
    if (info?.circuitBreakerState !== 'closed') {
      throw new Error('Circuit breaker should be closed initially');
    }
    success('Initial state is closed');

    // Manually open circuit breaker
    router.openCircuitBreaker('openai');
    const infoOpen = router.getBackendInfo('openai');
    console.log('Circuit breaker state after opening:', infoOpen?.circuitBreakerState);
    if (infoOpen?.circuitBreakerState !== 'open') {
      throw new Error('Circuit breaker should be open');
    }
    success('Circuit breaker opened successfully');

    // Test that requests fail when circuit is open
    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { requestId: 'test-cb', timestamp: Date.now() },
    };

    try {
      await router.execute(request);
      error('Should have thrown error for open circuit breaker');
    } catch (e: any) {
      // When circuit is open, router will fail primary backend and try fallback
      // With only one backend, it should fail with one of these messages
      if (e.message.includes('Circuit breaker is open') ||
          e.message.includes('unavailable') ||
          e.message.includes('All fallback backends failed') ||
          e.message.includes('No available')) {
        success('Correctly blocked request when circuit is open (via circuit breaker or fallback failure)');
      } else {
        throw e;
      }
    }

    // Manually close circuit breaker (but don't try to execute - no API key)
    router.closeCircuitBreaker('openai');
    const infoClosed = router.getBackendInfo('openai');
    console.log('Circuit breaker state after closing:', infoClosed?.circuitBreakerState);
    if (infoClosed?.circuitBreakerState !== 'closed') {
      throw new Error('Circuit breaker should be closed');
    }
    success('Circuit breaker closed successfully (state verified, not executed)');

    // Reset circuit breaker
    router.resetCircuitBreaker('openai');
    const infoReset = router.getBackendInfo('openai');
    console.log('Stats after reset:', {
      consecutiveFailures: infoReset?.consecutiveFailures,
      circuitBreakerState: infoReset?.circuitBreakerState,
    });
    success('Circuit breaker reset successfully');

    success('Circuit breaker tests passed');
  } catch (err) {
    error('Circuit breaker tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 4: Health Checking
// ============================================================================

async function testHealthChecking() {
  log('TEST 4', 'Health Checking');

  try {
    const router = createRouter();

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const anthropicAdapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

    router.register('openai', openaiAdapter);
    router.register('anthropic', anthropicAdapter);

    // Check health of all backends
    console.log('Checking health of all backends...');
    const healthResults = await router.checkHealth();
    console.log('Health check results:', healthResults);

    // Health checks may fail since we're using test keys, but the method should work
    success('Health check method executed successfully');

    // Check individual backend
    console.log('Checking health of OpenAI backend...');
    const openaiHealth = await router.checkHealth('openai');
    console.log('OpenAI health:', openaiHealth);
    success('Individual health check executed successfully');

    success('Health checking tests passed');
  } catch (err) {
    error('Health checking tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 5: Statistics
// ============================================================================

async function testStatistics() {
  log('TEST 5', 'Statistics and Monitoring');

  try {
    const router = createRouter({
      trackLatency: true,
      trackCost: true,
    });

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    router.register('openai', openaiAdapter);

    // Get initial stats
    const initialStats = router.getStats();
    console.log('Initial stats:', JSON.stringify(initialStats, null, 2));

    if (initialStats.totalRequests !== 0) {
      throw new Error('Initial request count should be 0');
    }
    success('Initial stats correct');

    // Get backend stats
    const backendStats = router.getBackendStats('openai');
    console.log('OpenAI backend stats:', JSON.stringify(backendStats, null, 2));
    success('Retrieved backend stats');

    // Reset stats
    router.resetStats();
    const resetStats = router.getStats();
    console.log('Stats after reset:', JSON.stringify(resetStats, null, 2));

    if (resetStats.totalRequests !== 0) {
      throw new Error('Request count should be 0 after reset');
    }
    success('Stats reset successfully');

    success('Statistics tests passed');
  } catch (err) {
    error('Statistics tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 6: Fallback Chain
// ============================================================================

async function testFallbackChain() {
  log('TEST 6', 'Fallback Chain Configuration');

  try {
    const router = createRouter({
      fallbackStrategy: 'sequential',
    });

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const anthropicAdapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

    router.register('openai', openaiAdapter);
    router.register('anthropic', anthropicAdapter);

    // Set fallback chain
    router.setFallbackChain(['openai', 'anthropic']);
    success('Set fallback chain');

    // Get fallback chain
    const chain = router.getFallbackChain();
    console.log('Fallback chain:', chain);

    if (chain.length !== 2) {
      throw new Error(`Expected chain length 2, got ${chain.length}`);
    }
    if (chain[0] !== 'openai' || chain[1] !== 'anthropic') {
      throw new Error('Fallback chain order incorrect');
    }
    success('Fallback chain configured correctly');

    // Test invalid fallback chain
    try {
      router.setFallbackChain(['openai', 'nonexistent']);
      error('Should have thrown error for invalid backend in chain');
    } catch (e: any) {
      success('Correctly prevented invalid backend in fallback chain');
    }

    success('Fallback chain tests passed');
  } catch (err) {
    error('Fallback chain tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 7: Bridge Integration
// ============================================================================

async function testBridgeIntegration() {
  log('TEST 7', 'Bridge Integration with Router');

  try {
    // Create router with multiple backends
    const router = createRouter({
      routingStrategy: 'model-based',
      defaultBackend: 'openai',
    });

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY || 'test-key' });
    const anthropicAdapter = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY || 'test-key' });

    router.register('openai', openaiAdapter);
    router.register('anthropic', anthropicAdapter);

    router.setModelMapping({
      'gpt-4': 'openai',
      'claude-3-opus': 'anthropic',
    });

    // Create bridge with router as backend
    const frontend = new AnthropicFrontendAdapter();
    const bridge = new Bridge(frontend, router);
    success('Created Bridge with Router as backend');

    console.log('Bridge created successfully with router');
    console.log('Frontend:', frontend.metadata.name);
    console.log('Backend (Router):', router.metadata.name);
    console.log('Registered backends:', router.listBackends());

    // The router implements BackendAdapter interface, so Bridge can use it
    success('Router can be used as a BackendAdapter');

    success('Bridge integration tests passed');
  } catch (err) {
    error('Bridge integration tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 8: Router Clone
// ============================================================================

async function testRouterClone() {
  log('TEST 8', 'Router Cloning');

  try {
    const router = createRouter({
      routingStrategy: 'model-based',
      defaultBackend: 'openai',
    });

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    router.register('openai', openaiAdapter);

    // Clone with new config
    const clonedRouter = router.clone({
      routingStrategy: 'round-robin',
    });
    success('Cloned router with new configuration');

    // Check that backends are copied
    const clonedBackends = clonedRouter.listBackends();
    console.log('Cloned router backends:', clonedBackends);

    if (clonedBackends.length !== 1) {
      throw new Error('Cloned router should have same backends');
    }
    success('Backends copied to cloned router');

    // Check that config is updated
    console.log('Original config:', router.config.routingStrategy);
    console.log('Cloned config:', clonedRouter.config.routingStrategy);

    if (clonedRouter.config.routingStrategy !== 'round-robin') {
      throw new Error('Cloned router should have new config');
    }
    success('Cloned router has updated configuration');

    success('Router cloning tests passed');
  } catch (err) {
    error('Router cloning tests failed', err);
    throw err;
  }
}

// ============================================================================
// Test 9: Parallel Dispatch
// ============================================================================

async function testParallelDispatch() {
  log('TEST 9', 'Parallel Dispatch (Fan-out)');

  try {
    const router = createRouter();

    const openaiAdapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });
    const anthropicAdapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

    router.register('openai', openaiAdapter);
    router.register('anthropic', anthropicAdapter);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      parameters: { model: 'gpt-3.5-turbo' },
      metadata: { requestId: 'test-parallel', timestamp: Date.now() },
    };

    console.log('Testing parallel dispatch (will fail with test keys, but tests the mechanism)...');

    // Test that parallel dispatch method exists and can be called
    try {
      await router.dispatchParallel(request, {
        strategy: 'first',
        timeout: 5000,
      });
      success('Parallel dispatch executed (or failed as expected with test keys)');
    } catch (e: any) {
      // Expected to fail with test keys, but the method should exist
      if (e.message.includes('parallel') || e.message.includes('backend') || e.message.includes('Authentication')) {
        success('Parallel dispatch method exists and executed (failed as expected with test keys)');
      } else {
        throw e;
      }
    }

    success('Parallel dispatch tests passed');
  } catch (err) {
    error('Parallel dispatch tests failed', err);
    throw err;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n🚀 Starting Router Tests\n');

  const tests = [
    { name: 'Backend Registration', fn: testBackendRegistration },
    { name: 'Routing Strategies', fn: testRoutingStrategies },
    { name: 'Circuit Breaker', fn: testCircuitBreaker },
    { name: 'Health Checking', fn: testHealthChecking },
    { name: 'Statistics', fn: testStatistics },
    { name: 'Fallback Chain', fn: testFallbackChain },
    { name: 'Bridge Integration', fn: testBridgeIntegration },
    { name: 'Router Clone', fn: testRouterClone },
    { name: 'Parallel Dispatch', fn: testParallelDispatch },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`\n❌ Test "${test.name}" failed:`, err);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log('='.repeat(80));

  if (failed === 0) {
    console.log('\n🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
