import { createHooks } from 'hookable';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { pathToFileURL } from 'url';

/**
 * Plugin Hook System for create-polyglot
 * 
 * Provides a robust, configurable plugin execution pipeline with:
 * - Lifecycle hooks at key points in the CLI workflow
 * - Plugin dependency resolution and ordering
 * - Error handling and graceful degradation
 * - Plugin enable/disable functionality
 * - Comprehensive logging and debugging
 */

// Define all available hook points in the create-polyglot lifecycle
export const HOOK_POINTS = {
  // Project initialization hooks
  'before:init': 'Called before project scaffolding begins',
  'after:init': 'Called after project scaffolding completes',
  'before:template:copy': 'Called before copying service templates',
  'after:template:copy': 'Called after copying service templates',
  'before:dependencies:install': 'Called before installing dependencies',
  'after:dependencies:install': 'Called after installing dependencies',
  
  // Service management hooks
  'before:service:add': 'Called before adding a new service',
  'after:service:add': 'Called after adding a new service',
  'before:service:remove': 'Called before removing a service',
  'after:service:remove': 'Called after removing a service',
  
  // Development workflow hooks
  'before:dev:start': 'Called before starting dev server(s)',
  'after:dev:start': 'Called after dev server(s) have started',
  'before:dev:stop': 'Called before stopping dev server(s)',
  'after:dev:stop': 'Called after dev server(s) have stopped',
  
  // Docker hooks
  'before:docker:build': 'Called before building Docker images',
  'after:docker:build': 'Called after building Docker images',
  'before:compose:up': 'Called before running docker compose up',
  'after:compose:up': 'Called after docker compose up completes',
  
  // Hot reload hooks
  'before:hotreload:start': 'Called before starting hot reload',
  'after:hotreload:start': 'Called after hot reload is active',
  'before:hotreload:restart': 'Called before restarting a service',
  'after:hotreload:restart': 'Called after a service restarts',
  
  // Admin dashboard hooks
  'before:admin:start': 'Called before starting admin dashboard',
  'after:admin:start': 'Called after admin dashboard is running',
  
  // Log management hooks
  'before:logs:view': 'Called before viewing logs',
  'after:logs:view': 'Called after log viewing session',
  'before:logs:clear': 'Called before clearing logs',
  'after:logs:clear': 'Called after clearing logs',
  
  // Plugin lifecycle hooks
  'before:plugin:load': 'Called before loading a plugin',
  'after:plugin:load': 'Called after loading a plugin',
  'before:plugin:unload': 'Called before unloading a plugin',
  'after:plugin:unload': 'Called after unloading a plugin'
};

class PluginSystem {
  constructor() {
    this.hooks = createHooks();
    this.plugins = new Map();
    this.pluginOrder = [];
    this.config = null;
    this.projectDir = null;
    this.isInitialized = false;
    this.debug = process.env.DEBUG_PLUGINS === 'true';
  }

  /**
   * Initialize the plugin system for a project
   */
  async initialize(projectDir) {
    this.projectDir = projectDir;
    
    try {
      // Load project configuration
      const configPath = path.join(projectDir, 'polyglot.json');
      if (await fs.pathExists(configPath)) {
        this.config = await fs.readJson(configPath);
      } else {
        this.config = { plugins: {} };
      }

      // Discover and load plugins
      await this.discoverPlugins();
      await this.loadPlugins();
      
      this.isInitialized = true;
      this.log('Plugin system initialized', { pluginCount: this.plugins.size });
      
      // Call the plugin load hooks
      await this.callHook('after:plugin:load', { system: this });
      
    } catch (error) {
      this.logError('Failed to initialize plugin system', error);
      // Don't throw - allow CLI to continue without plugins
    }
  }

  /**
   * Discover plugins in the plugins directory and from configuration
   */
  async discoverPlugins() {
    const discoveredPlugins = [];
    
    // Discover local and external plugins
    const localPlugins = await this.discoverLocalPlugins();
    const externalPlugins = this.discoverExternalPlugins();
    
    discoveredPlugins.push(...localPlugins, ...externalPlugins);

    // Sort plugins by priority (higher priority loads first)
    this.sortPluginsByPriority(discoveredPlugins);

    this.pluginOrder = discoveredPlugins;
    this.log('Discovered plugins', { count: discoveredPlugins.length });
  }

  /**
   * Discover local plugins in both .polyglot/plugins and plugins directories
   */
  async discoverLocalPlugins() {
    const localPlugins = [];
    
    // Check both .polyglot/plugins and plugins directories for backward compatibility
    const pluginDirs = [
      path.join(this.projectDir, '.polyglot', 'plugins'),
      path.join(this.projectDir, 'plugins')
    ];

    for (const pluginsDir of pluginDirs) {
      if (await fs.pathExists(pluginsDir)) {
        const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(pluginsDir, entry.name, 'index.js');
            if (await fs.pathExists(pluginPath)) {
              // Only add if not already added from another directory
              if (!localPlugins.find(p => p.name === entry.name)) {
                localPlugins.push({
                  name: entry.name,
                  type: 'local',
                  path: pluginPath,
                  enabled: this.config?.plugins?.[entry.name]?.enabled !== false
                });
              }
            }
          }
        }
      }
    }

    return localPlugins;
  }

  /**
   * Discover external plugins from configuration
   */
  discoverExternalPlugins() {
    const externalPlugins = [];

    if (this.config?.plugins) {
      for (const [name, config] of Object.entries(this.config.plugins)) {
        if (config.external && config.enabled !== false) {
          externalPlugins.push({
            name,
            type: 'external',
            path: config.external,
            config: config,
            enabled: true
          });
        }
      }
    }

    return externalPlugins;
  }

  /**
   * Sort plugins by priority
   */
  sortPluginsByPriority(plugins) {
    plugins.sort((a, b) => {
      const priorityA = this.config?.plugins?.[a.name]?.priority || 0;
      const priorityB = this.config?.plugins?.[b.name]?.priority || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Load all discovered plugins
   */
  async loadPlugins() {
    for (const pluginInfo of this.pluginOrder) {
      if (!pluginInfo.enabled) {
        this.log(`Skipping disabled plugin: ${pluginInfo.name}`);
        continue;
      }

      try {
        await this.callHook('before:plugin:load', { pluginInfo });
        await this.loadPlugin(pluginInfo);
      } catch (error) {
        this.logError(`Failed to load plugin: ${pluginInfo.name}`, error);
        // Continue loading other plugins
      }
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginInfo) {
    try {
      let pluginModule;
      
      if (pluginInfo.type === 'local') {
        // Load local plugin using file:// URL
        const pluginUrl = pathToFileURL(pluginInfo.path).href;
        pluginModule = await import(pluginUrl);
      } else {
        // Load external plugin (npm module or URL)
        pluginModule = await import(pluginInfo.path);
      }

      const plugin = pluginModule.default || pluginModule;
      
      // Validate plugin structure
      if (!plugin || typeof plugin !== 'object') {
        throw new Error('Plugin must export an object');
      }

      if (!plugin.name) {
        plugin.name = pluginInfo.name;
      }

      // Register plugin hooks
      if (plugin.hooks && typeof plugin.hooks === 'object') {
        for (const [hookName, handler] of Object.entries(plugin.hooks)) {
          if (typeof handler === 'function') {
            this.hooks.hook(hookName, handler.bind(plugin));
          }
        }
      }

      // Store plugin reference
      this.plugins.set(pluginInfo.name, {
        ...pluginInfo,
        plugin,
        loadedAt: new Date()
      });

      this.log(`Loaded plugin: ${pluginInfo.name}`, { 
        type: pluginInfo.type,
        hooks: Object.keys(plugin.hooks || {})
      });

    } catch (error) {
      throw new Error(`Failed to load plugin ${pluginInfo.name}: ${error.message}`);
    }
  }

  /**
   * Call a specific hook with context data
   */
  async callHook(hookName, context = {}) {
    if (!this.isInitialized && !hookName.includes('plugin:load')) {
      this.log(`Plugin system not initialized, skipping hook: ${hookName}`);
      return;
    }

    try {
      const enrichedContext = {
        ...context,
        projectDir: this.projectDir,
        config: this.config,
        timestamp: new Date(),
        hookName
      };

      this.log(`Calling hook: ${hookName}`, { 
        contextKeys: Object.keys(enrichedContext),
        hookCount: this.hooks.hookMap?.[hookName]?.length || 0
      });

      await this.hooks.callHook(hookName, enrichedContext);
      
    } catch (error) {
      this.logError(`Hook execution failed: ${hookName}`, error);
      // Don't throw - allow CLI to continue
    }
  }

  /**
   * Get information about a specific plugin
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Get all loaded plugins
   */
  getPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all discovered plugins (both enabled and disabled)
   */
  getAllPlugins() {
    const result = [];
    
    for (const pluginInfo of this.pluginOrder) {
      const loadedPlugin = this.plugins.get(pluginInfo.name);
      if (loadedPlugin) {
        // Plugin is loaded
        result.push(loadedPlugin);
      } else {
        // Plugin was discovered but not loaded (likely disabled)
        result.push({
          name: pluginInfo.name,
          type: pluginInfo.type,
          path: pluginInfo.path,
          enabled: pluginInfo.enabled,
          plugin: null // Not loaded, so no plugin object
        });
      }
    }
    
    return result;
  }

  /**
   * Check if a plugin is loaded and enabled
   */
  isPluginLoaded(name) {
    return this.plugins.has(name);
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(name) {
    if (!this.config) {
      throw new Error('Plugin system not initialized');
    }

    if (!this.config.plugins) {
      this.config.plugins = {};
    }

    if (!this.config.plugins[name]) {
      this.config.plugins[name] = {};
    }

    this.config.plugins[name].enabled = true;
    await this.saveConfig();
    
    // Reload if not currently loaded
    if (!this.isPluginLoaded(name)) {
      await this.discoverPlugins();
      const pluginInfo = this.pluginOrder.find(p => p.name === name);
      if (pluginInfo?.enabled) {
        await this.loadPlugin(pluginInfo);
      }
    }

    this.log(`Enabled plugin: ${name}`);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(name) {
    if (!this.config) {
      throw new Error('Plugin system not initialized');
    }

    if (!this.config.plugins) {
      this.config.plugins = {};
    }

    if (!this.config.plugins[name]) {
      this.config.plugins[name] = {};
    }

    this.config.plugins[name].enabled = false;
    await this.saveConfig();

    // Remove from loaded plugins
    if (this.plugins.has(name)) {
      await this.callHook('before:plugin:unload', { plugin: this.plugins.get(name) });
      this.plugins.delete(name);
      await this.callHook('after:plugin:unload', { pluginName: name });
    }

    this.log(`Disabled plugin: ${name}`);
  }

  /**
   * Configure a plugin
   */
  async configurePlugin(name, config) {
    if (!this.config) {
      throw new Error('Plugin system not initialized');
    }

    if (!this.config.plugins) {
      this.config.plugins = {};
    }

    if (!this.config.plugins[name]) {
      this.config.plugins[name] = {};
    }

    Object.assign(this.config.plugins[name], config);
    await this.saveConfig();

    this.log(`Configured plugin: ${name}`, config);
  }

  /**
   * Save plugin configuration to polyglot.json
   */
  async saveConfig() {
    if (this.config && this.projectDir) {
      const configPath = path.join(this.projectDir, 'polyglot.json');
      await fs.writeJson(configPath, this.config, { spaces: 2 });
    }
  }

  /**
   * Get hook points and their descriptions
   */
  getHookPoints() {
    return HOOK_POINTS;
  }

  /**
   * Get statistics about the plugin system
   */
  getStats() {
    const hooks = {};
    // Handle case where hookMap might be undefined
    if (this.hooks.hookMap) {
      for (const [hookName, handlers] of Object.entries(this.hooks.hookMap)) {
        hooks[hookName] = handlers.length;
      }
    }

    const allPlugins = this.getAllPlugins();
    const enabledPlugins = allPlugins.filter(p => p.enabled);

    return {
      initialized: this.isInitialized,
      projectDir: this.projectDir,
      totalPlugins: allPlugins.length,
      enabledPlugins: enabledPlugins.length,
      hookPoints: Object.keys(HOOK_POINTS).length,
      registeredHooks: hooks,
      config: this.config?.plugins || {}
    };
  }

  /**
   * Logging helper
   */
  log(message, data = {}) {
    if (this.debug) {
      console.log(chalk.blue(`[plugins] ${message}`), data);
    }
  }

  /**
   * Error logging helper
   */
  logError(message, error) {
    console.error(chalk.red(`[plugins] ${message}:`), error?.message || error);
    if (this.debug && error?.stack) {
      console.error(error.stack);
    }
  }
}

// Global plugin system instance
export const pluginSystem = new PluginSystem();

// Convenience function to initialize plugins for a project
export async function initializePlugins(projectDir) {
  await pluginSystem.initialize(projectDir);
}

// Convenience function to call hooks
export async function callHook(hookName, context = {}) {
  await pluginSystem.callHook(hookName, context);
}

export default pluginSystem;