import React, { useState, useEffect } from 'react';
import DynamicComponent from './DynamicComponent';
import './AiComponentManager.css';

interface AiComponentManagerProps {
  onRequestComponent: (prompt: string) => Promise<void>;
}

const AiComponentManager: React.FC<AiComponentManagerProps> = ({ onRequestComponent }) => {
  const [components, setComponents] = useState<string[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Load the list of available components
  useEffect(() => {
    const loadComponents = async () => {
      try {
        const componentList = await window.electronAPI.listReactComponents();
        setComponents(componentList);
      } catch (error) {
        console.error('Error loading components:', error);
      }
    };

    loadComponents();
  }, []);

  const handleRequestComponent = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      await onRequestComponent(prompt);
      // Refresh the component list
      const componentList = await window.electronAPI.listReactComponents();
      setComponents(componentList);
      setPrompt('');
    } catch (error) {
      console.error('Error requesting component:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveComponent = async (name: string) => {
    try {
      await window.electronAPI.removeReactComponent(name);
      // Refresh the component list
      const componentList = await window.electronAPI.listReactComponents();
      setComponents(componentList);
      if (selectedComponent === name) {
        setSelectedComponent(null);
      }
    } catch (error) {
      console.error(`Error removing component ${name}:`, error);
    }
  };

  return (
    <div className="ai-component-manager">
      <div className="component-request">
        <h3>Request a React Component</h3>
        <div className="input-group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the React component you want the AI to create..."
            disabled={loading}
          />
          <button onClick={handleRequestComponent} disabled={loading || !prompt.trim()}>
            {loading ? 'Generating...' : 'Generate Component'}
          </button>
        </div>
      </div>

      <div className="component-list">
        <h3>Available Components</h3>
        {components.length === 0 ? (
          <p>No components available. Request one above!</p>
        ) : (
          <ul>
            {components.map((name) => (
              <li key={name}>
                <button
                  className={selectedComponent === name ? 'selected' : ''}
                  onClick={() => setSelectedComponent(name)}
                >
                  {name}
                </button>
                <button className="remove-btn" onClick={() => handleRemoveComponent(name)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedComponent && (
        <div className="component-preview">
          <h3>Component Preview: {selectedComponent}</h3>
          <div className="preview-container">
            <DynamicComponent componentName={selectedComponent} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AiComponentManager; 