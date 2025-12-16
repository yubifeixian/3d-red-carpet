import React, { useState, useEffect } from 'react';
import { AppState, ModelType, ModelFile } from './types';
import UploadPanel from './components/UploadPanel';
import AnalysisPanel from './components/AnalysisPanel';
import SceneContainer from './components/SceneContainer';

const INITIAL_FILES: ModelFile[] = [
  { type: ModelType.BASE, file: null, url: null },
  { type: ModelType.IDLE, file: null, url: null },
  { type: ModelType.WALK, file: null, url: null },
  { type: ModelType.RUN, file: null, url: null },
  { type: ModelType.DANCE, file: null, url: null },
  { type: ModelType.WALL_BG, file: null, url: null },
  { type: ModelType.WALL_FG, file: null, url: null },
];

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
  const [modelFiles, setModelFiles] = useState<ModelFile[]>(INITIAL_FILES);
  
  // Cache for the last successfully loaded set of files
  const [cachedFiles, setCachedFiles] = useState<ModelFile[] | null>(null);

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
    setModelFiles(INITIAL_FILES);
    // Reload cache from DB ensures we have fresh URLs if needed, 
    // though memory state is usually fine. 
    // We do NOT clear cachedFiles here.
  };

  // Helper to get URL by type
  const getUrl = (type: ModelType) => modelFiles.find((m) => m.type === type)?.url || '';
  
  // Only check validity, don't perform heavy logic here. Base model is required.
  const canAnalyze = !!modelFiles.find(m => m.type === ModelType.BASE)?.file;

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
             />
          </div>
        )}
      </main>
    </div>
  );
}