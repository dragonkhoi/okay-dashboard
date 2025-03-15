import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { useEffect, useState } from "react";
import { AppConfig } from "../services/config";

const SettingsSheet: React.FC = () => {
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    // Load current configuration
    const loadConfig = async () => {
      try {
        const config = await window.electronAPI.getAppConfig();
        if (config) {
          setAnthropicApiKey(config.anthropicApiKey || "");
          setAiModel(config.aiModel || "claude-3-5-sonnet-20240620");
          setMaxTokens(config.maxTokens?.toString() || "4096");
        }
      } catch (error) {
        console.error("Failed to load app configuration:", error);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    
    try {
      const envVars: Record<string, string> = {
        ANTHROPIC_API_KEY: anthropicApiKey,
        AI_MODEL: aiModel,
        MAX_TOKENS: maxTokens,
      };
      
      const success = await window.electronAPI.saveEnvConfig(envVars);
      
      if (success) {
        setSaveMessage("Settings saved successfully! The API key has been updated and is ready to use immediately. Other settings will take effect after restart.");
      } else {
        setSaveMessage("Failed to save settings. Please try again.");
      }
    } catch (error) {
      console.error("Error saving environment variables:", error);
      setSaveMessage("An error occurred while saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="max-w-9">
          <Cog6ToothIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="anthropic-api-key">Anthropic API Key</Label>
            <Input
              id="anthropic-api-key"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder="sk-ant-api03-..."
            />
            <p className="text-xs text-gray-500">
              API key changes take effect immediately.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-model">Anthropic Model</Label>
            <Input
              id="ai-model"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="claude-3-5-sonnet-20240620"
            />
            <p className="text-xs text-gray-500">
              Model changes require app restart.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="4096"
            />
            <p className="text-xs text-gray-500">
              Token limit changes require app restart.
            </p>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="mt-4"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
          
          {saveMessage && (
            <div className={`mt-2 p-2 text-sm rounded ${saveMessage.includes("successfully") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {saveMessage}
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            <p>These settings are saved to your .env file and will persist between app restarts.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
