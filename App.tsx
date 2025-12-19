import React, { useState, useEffect, useMemo } from 'react';
import { AppState, ModelType, ModelFile, ModelFormat } from './types';
import UploadPanel from './components/UploadPanel';
import AnalysisPanel from './components/AnalysisPanel';
import SceneContainer from './components/SceneContainer';

// 默认模型文件配置，按格式分类
const DEFAULT_MODEL_FILES = {
  [ModelFormat.GLB]: [
    { type: ModelType.BASE, file: null, url: '/model/schoolgirl+3d+model.glb' },
    { type: ModelType.IDLE, file: null, url: '/model/Idle.glb' },
    { type: ModelType.WALK, file: null, url: '/model/walk.glb' },
    { type: ModelType.RUN, file: null, url: '/model/Slow Run.glb' },
    { type: ModelType.DANCE, file: null, url: '/model/Belly Dance.glb' },
    { type: ModelType.WALL_BG, file: null, url: '/model/bgB.webp' },
    { type: ModelType.WALL_FG, file: null, url: '/model/bgA.webp' },
  ],
  [ModelFormat.FBX]: [
    { type: ModelType.BASE, file: null, url: '/model/schoolgirl+3d+model.fbx' },
    { type: ModelType.IDLE, file: null, url: '/model/Idle.fbx' },
    { type: ModelType.WALK, file: null, url: '/model/walk.fbx' },
    { type: ModelType.RUN, file: null, url: '/model/Slow Run.fbx' },
    { type: ModelType.DANCE, file: null, url: '/model/Belly Dance.fbx' },
    { type: ModelType.WALL_BG, file: null, url: '/model/bgB.webp' },
    { type: ModelType.WALL_FG, file: null, url: '/model/bgA.webp' },
  ]
};

// --- IndexedDB Helpers ---
const DB_NAME = 'SmartAnimatorDB';
const STORE_NAME = 'models';

const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Increment version for schema changes if needed
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToCacheDB = async (files: ModelFile[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    files.forEach(f => {
      if (f.file) {
        store.put(f.file, f.type);
      }
    });
    
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
  } catch (e) {
    console.error("Failed to save to cache", e);
  }
};

const loadFromCacheDB = async (): Promise<ModelFile[] | null> => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    // Include new types in keys
    const keys = [
        ModelType.BASE, ModelType.IDLE, ModelType.WALK, ModelType.RUN, ModelType.DANCE,
        ModelType.WALL_BG, ModelType.WALL_FG
    ];
    
    const loadedFiles: ModelFile[] = [];
    let hasData = false;

    for (const typeKey of keys) {
      const file = await new Promise<File | undefined>((resolve) => {
        const req = store.get(typeKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });

      if (file) {
        hasData = true;
        loadedFiles.push({
          type: typeKey as ModelType,
          file: file,
          url: URL.createObjectURL(file)
        });
      } else {
        loadedFiles.push({ type: typeKey as ModelType, file: null, url: null });
      }
    }
    
    // We need at least the base model to consider it a valid cache
    if (!hasData || !loadedFiles.find(f => f.type === ModelType.BASE)?.file) return null;
    return loadedFiles;
  } catch (e) {
    console.error("Failed to load from cache", e);
    return null;
  }
};


export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [modelFormat, setModelFormat] = useState<ModelFormat>(ModelFormat.GLB);
  
  // 根据选择的模型格式获取默认文件配置
  const initialFiles = useMemo(() => DEFAULT_MODEL_FILES[modelFormat], [modelFormat]);
  
  // 只有在模型格式改变时才重置模型文件
  const [modelFiles, setModelFiles] = useState<ModelFile[]>(initialFiles);
  
  // Cache for the last successfully loaded set of files
  const [cachedFiles, setCachedFiles] = useState<ModelFile[] | null>(null);
  
  // 当模型格式改变时，重置模型文件为对应格式的默认文件
  useEffect(() => {
    setModelFiles(DEFAULT_MODEL_FILES[modelFormat]);
  }, [modelFormat]);

  // Load cache on mount
  useEffect(() => {
    loadFromCacheDB().then((files) => {
        if (files) {
            console.log("Cache loaded from IndexedDB");
            setCachedFiles(files);
        }
    });
  }, []);

  const handleFileChange = (type: ModelType, file: File) => {
    const url = URL.createObjectURL(file);
    setModelFiles((prev) =>
      prev.map((item) => (item.type === type ? { ...item, file, url } : item))
    );
  };

  const handleUseCache = () => {
    if (cachedFiles) {
      setModelFiles(cachedFiles);
      setAppState(AppState.ANALYSIS);
    }
  };

  const startSimulation = () => {
    // Save successful configuration to memory state AND IndexedDB
    // This runs when Analysis completes successfully
    console.log("Saving models to cache...");
    setCachedFiles(modelFiles);
    saveToCacheDB(modelFiles);

    setAppState(AppState.SIMULATION);
  };

  const reset = () => {
    setAppState(AppState.UPLOAD);
    setModelFiles(DEFAULT_MODEL_FILES[modelFormat]);
    // Reload cache from DB ensures we have fresh URLs if needed, 
    // though memory state is usually fine. 
    // We do NOT clear cachedFiles here.
  };

  // Helper to get URL by type
  const getUrl = (type: ModelType) => modelFiles.find((m) => m.type === type)?.url || '';
  
  // Only check validity, don't perform heavy logic here. Base model is required.
  // Allow using default URLs if no file is uploaded
  const canAnalyze = !!modelFiles.find(m => m.type === ModelType.BASE)?.file || !!modelFiles.find(m => m.type === ModelType.BASE)?.url;

  return (
    <div className="w-full h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center">
            <i className="fa-solid fa-cube text-white"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Smart Model Animator</h1>
        </div>
        <div>
          {appState !== AppState.UPLOAD && (
             <button 
             onClick={reset}
             className="text-sm text-slate-400 hover:text-white transition-colors"
           >
             <i className="fa-solid fa-rotate-left mr-2"></i>
             Reset / New Upload
           </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        
        {appState === AppState.UPLOAD && (
          <div className="absolute inset-0 overflow-y-auto p-4 flex justify-center">
            <UploadPanel 
              files={modelFiles} 
              onFileChange={handleFileChange} 
              onProceed={() => setAppState(AppState.ANALYSIS)} 
              ready={canAnalyze}
              hasCache={!!cachedFiles}
              onUseCache={handleUseCache}
              modelFormat={modelFormat}
              onModelFormatChange={setModelFormat}
            />
          </div>
        )}

        {appState === AppState.ANALYSIS && (
          <div className="absolute inset-0 overflow-y-auto p-4 flex justify-center">
             <AnalysisPanel 
                files={modelFiles}
                onComplete={startSimulation}
                onBack={() => setAppState(AppState.UPLOAD)}
             />
          </div>
        )}

        {appState === AppState.SIMULATION && (
          <div className="absolute inset-0">
             <SceneContainer 
                baseUrl={getUrl(ModelType.BASE)}
                idleUrl={getUrl(ModelType.IDLE)}
                walkUrl={getUrl(ModelType.WALK)}
                runUrl={getUrl(ModelType.RUN)}
                danceUrl={getUrl(ModelType.DANCE)}
                wallBgUrl={getUrl(ModelType.WALL_BG)}
                wallFgUrl={getUrl(ModelType.WALL_FG)}
                modelFormat={modelFormat}
             />
          </div>
        )}
      </main>
    </div>
  );
}