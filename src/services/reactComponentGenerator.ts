import React from 'react';
import { createElement } from 'react';

export interface ReactComponentCode {
  code: string;
  name: string;
}

export class ReactComponentGeneratorService {
  private components: Map<string, React.ComponentType<any>> = new Map();

  /**
   * Compiles and registers a React component from code string
   * @param componentCode The React component code as a string
   * @param componentName The name of the component
   * @returns The name of the registered component
   */
  registerComponent(componentCode: string, componentName: string): string {
    try {
      // Create a function that will evaluate the code and return the component
      const componentFunction = new Function(
        'React', 
        'createElement',
        `${componentCode}
        return ${componentName};`
      );

      // Execute the function to get the component
      const Component = componentFunction(React, createElement);
      
      // Register the component
      this.components.set(componentName, Component);
      
      return componentName;
    } catch (error) {
      console.error('Error registering React component:', error);
      throw error;
    }
  }

  /**
   * Gets a registered component by name
   * @param name The name of the component
   * @returns The React component or null if not found
   */
  getComponent(name: string): React.ComponentType<any> | null {
    return this.components.get(name) || null;
  }

  /**
   * Lists all registered component names
   * @returns Array of component names
   */
  listComponents(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Removes a component from the registry
   * @param name The name of the component to remove
   */
  removeComponent(name: string): void {
    this.components.delete(name);
  }

  /**
   * Clears all registered components
   */
  clearComponents(): void {
    this.components.clear();
  }
} 