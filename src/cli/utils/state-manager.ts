/**
 * State Manager Utility
 *
 * Tracks running models and backend state for CLI.
 * Used by `ps` command to show active models.
 *
 * @module cli/utils/state-manager
 */

export interface RunningModel {
  /**
   * Model name.
   */
  name: string;

  /**
   * Backend name/identifier.
   */
  backend: string;

  /**
   * Process ID (for model runners).
   */
  pid?: number;

  /**
   * Model size in bytes (if known).
   */
  size?: number;

  /**
   * When the model was started.
   */
  startTime: number;

  /**
   * Last activity timestamp.
   */
  lastActivity: number;

  /**
   * TTL in milliseconds (when to auto-stop).
   */
  ttl?: number;

  /**
   * Additional metadata.
   */
  metadata?: Record<string, any>;
}

/**
 * Global state manager for running models.
 */
class StateManager {
  private models = new Map<string, RunningModel>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Add a running model.
   */
  add(model: RunningModel): void {
    const key = `${model.backend}:${model.name}`;
    this.models.set(key, model);

    // Set up cleanup timer if TTL specified
    if (model.ttl) {
      this.scheduleCleanup(key, model.ttl);
    }
  }

  /**
   * Update last activity time.
   */
  touch(backend: string, modelName: string): void {
    const key = `${backend}:${modelName}`;
    const model = this.models.get(key);

    if (model) {
      model.lastActivity = Date.now();

      // Reschedule cleanup if TTL set
      if (model.ttl) {
        this.scheduleCleanup(key, model.ttl);
      }
    }
  }

  /**
   * Remove a running model.
   */
  remove(backend: string, modelName: string): void {
    const key = `${backend}:${modelName}`;
    this.models.delete(key);

    // Clear cleanup timer
    const timer = this.cleanupTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(key);
    }
  }

  /**
   * Get a running model.
   */
  get(backend: string, modelName: string): RunningModel | undefined {
    const key = `${backend}:${modelName}`;
    return this.models.get(key);
  }

  /**
   * Get all running models.
   */
  getAll(): RunningModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by backend.
   */
  getByBackend(backend: string): RunningModel[] {
    return Array.from(this.models.values()).filter((m) => m.backend === backend);
  }

  /**
   * Check if model is running.
   */
  isRunning(backend: string, modelName: string): boolean {
    const key = `${backend}:${modelName}`;
    return this.models.has(key);
  }

  /**
   * Clear all models.
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    this.models.clear();
  }

  /**
   * Schedule cleanup after TTL.
   */
  private scheduleCleanup(key: string, ttl: number): void {
    // Clear existing timer
    const existingTimer = this.cleanupTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(() => {
      this.models.delete(key);
      this.cleanupTimers.delete(key);
    }, ttl);

    this.cleanupTimers.set(key, timer);
  }
}

/**
 * Global state manager instance.
 */
export const stateManager = new StateManager();
