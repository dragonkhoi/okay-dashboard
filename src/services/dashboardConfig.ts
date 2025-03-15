import * as fs from 'fs';
import * as path from 'path';
import { getAppRoot } from './config';

export interface DashboardQuestion {
  id?: number;
  question: string;
  additionalInstructions?: string;
  suggestedTitle?: string;
  suggestedType?: string;
  customColor?: string;
}

export interface DashboardConfig {
  questions: DashboardQuestion[];
}

const DEFAULT_CONFIG: DashboardConfig = {
  questions: [
  ]
};

export class DashboardConfigService {
  private configPath: string;

  constructor(configPath?: string) {
    const appRoot = getAppRoot();
    this.configPath = configPath || path.join(appRoot, 'dashboard-config.json');
  }

  /**
   * Load dashboard configuration from file
   */
  public loadConfig(): DashboardConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log(`Dashboard config file not found at ${this.configPath}, creating default config`);
        this.saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }

      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(fileContent) as DashboardConfig;

      // Validate the configuration
      if (!config.questions || !Array.isArray(config.questions)) {
        console.error('Invalid dashboard configuration: questions array is missing or invalid');
        return DEFAULT_CONFIG;
      }

      // Ensure all questions have an ID
      config.questions = config.questions.map((question, index) => ({
        ...question,
        id: question.id || index + 1
      }));

      return config;
    } catch (error) {
      console.error('Error loading dashboard configuration:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save dashboard configuration to file
   */
  public saveConfig(config: DashboardConfig): boolean {
    try {
      // Ensure all questions have an ID
      config.questions = config.questions.map((question, index) => ({
        ...question,
        id: question.id || index + 1
      }));

      const fileContent = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, fileContent, 'utf-8');
      return true;
    } catch (error) {
      console.error('Error saving dashboard configuration:', error);
      return false;
    }
  }

  /**
   * Get all dashboard questions
   */
  public getQuestions(): DashboardQuestion[] {
    const config = this.loadConfig();
    return config.questions;
  }

  /**
   * Add a new dashboard question
   */
  public addQuestion(question: DashboardQuestion): DashboardQuestion {
    const config = this.loadConfig();
    
    // Generate a new ID
    const maxId = config.questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
    const newQuestion = {
      ...question,
      id: maxId + 1
    };
    
    config.questions.push(newQuestion);
    this.saveConfig(config);
    
    return newQuestion;
  }

  /**
   * Update an existing dashboard question
   */
  public updateQuestion(id: number, question: Partial<DashboardQuestion>): DashboardQuestion | null {
    const config = this.loadConfig();
    const index = config.questions.findIndex(q => q.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedQuestion = {
      ...config.questions[index],
      ...question,
      id // Ensure ID doesn't change
    };
    
    config.questions[index] = updatedQuestion;
    this.saveConfig(config);
    
    return updatedQuestion;
  }

  /**
   * Delete a dashboard question
   */
  public deleteQuestion(id: number): boolean {
    const config = this.loadConfig();
    const index = config.questions.findIndex(q => q.id === id);
    
    if (index === -1) {
      return false;
    }
    
    config.questions.splice(index, 1);
    this.saveConfig(config);
    
    return true;
  }
} 