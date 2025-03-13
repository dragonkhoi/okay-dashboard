import React, { useState, useEffect } from 'react';

interface DynamicComponentProps {
  componentName: string;
  props?: Record<string, any>;
}

const DynamicComponent: React.FC<DynamicComponentProps> = ({ componentName, props = {} }) => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponent = async () => {
      try {
        // Check if the component exists
        // const result = await window.electronAPI.getReactComponent(componentName);
        
        // if (!result.exists) {
        //   setError(`Component "${componentName}" not found`);
        //   return;
        // }

        // Create a function that will evaluate the component code
        // This is a simplified version - in the actual implementation,
        // we're using the component registry in the main process
        const evalComponent = new Function(
          'React',
          `
          try {
            const Component = (props) => {
              return React.createElement('div', null, 'Component ${componentName} loaded');
            };
            return Component;
          } catch (error) {
            console.error('Error evaluating component:', error);
            return null;
          }
          `
        );

        const LoadedComponent = new Function("React", `function DynamicComponent() {
    return React.createElement("div", null, "Hello from Dynamic Component!");
  }`)(React); // evalComponent(React);
        setComponent(() => LoadedComponent);
        setError(null);
      } catch (error) {
        console.error('Error loading component:', error);
        setError(`Error loading component: ${(error as Error).message}`);
      }
    };

    loadComponent();
  }, [componentName]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!Component) {
    return <div className="loading">Loading component...</div>;
  }

  return <Component {...props} />;
};

export default DynamicComponent; 