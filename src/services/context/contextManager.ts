import * as fs from 'fs';
import * as path from 'path';
import { getAppRoot } from '../config';

/**
 * A simple service to manage semantic context for the agent
 * Stores information like account IDs, page references, etc.
 */
export class ContextManager {
  private contextFilePath: string;
  private context: Record<string, any>;

  constructor(contextFileName = 'agent-context.json') {
    const appRoot = getAppRoot();
    this.contextFilePath = path.join(appRoot, 'data', contextFileName);
    this.context = this.loadContext();
  }

  /**
   * Load context from the JSON file
   */
  private loadContext(): Record<string, any> {
    try {
      // Create the data directory if it doesn't exist
      const dataDir = path.dirname(this.contextFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create the context file if it doesn't exist
      if (!fs.existsSync(this.contextFilePath)) {
        fs.writeFileSync(this.contextFilePath, JSON.stringify({}, null, 2));
        return {};
      }

      // Read and parse the context file
      const contextData = fs.readFileSync(this.contextFilePath, 'utf-8');
      return JSON.parse(contextData);
    } catch (error) {
      console.error('Error loading context:', error);
      return {};
    }
  }

  /**
   * Save context to the JSON file
   */
  private saveContext(): void {
    try {
      fs.writeFileSync(this.contextFilePath, JSON.stringify(this.context, null, 2));
    } catch (error) {
      console.error('Error saving context:', error);
    }
  }

  /**
   * Get a value from the context
   * @param key The key to retrieve
   * @param defaultValue Optional default value if key doesn't exist
   */
  get(key: string, defaultValue: any = null): any {
    return key in this.context ? this.context[key] : defaultValue;
  }

  /**
   * Set a value in the context
   * @param key The key to set
   * @param value The value to store
   */
  set(key: string, value: any): void {
    this.context[key] = value;
    this.saveContext();
  }

  /**
   * Check if a key exists in the context
   * @param key The key to check
   */
  has(key: string): boolean {
    return key in this.context;
  }

  /**
   * Remove a key from the context
   * @param key The key to remove
   */
  remove(key: string): void {
    if (this.has(key)) {
      delete this.context[key];
      this.saveContext();
    }
  }

  /**
   * Get all context as an object
   */
  getAll(): Record<string, any> {
    return { ...this.context };
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.context = {};
    this.saveContext();
  }

  /**
   * Get context as a formatted string for inclusion in prompts
   */
  getContextString(): string {
    if (Object.keys(this.context).length === 0) {
      return '';
    }

    let contextString = '### Stored Context Information:\n';
    
    for (const [key, value] of Object.entries(this.context)) {
      contextString += `- ${key}: ${JSON.stringify(value)}\n`;
    }
    
    return contextString;
  }
} 