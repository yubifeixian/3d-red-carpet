import React, { useState } from 'react';
import { ModelFile, ModelType } from '../types';

interface Props {
  files: ModelFile[];
  onFileChange: (type: ModelType, file: File) => void;
  onProceed: () => void;
  ready: boolean;
  hasCache: boolean;
  onUseCache: () => void;
}

const InputCard: React.FC<{
  label: string;
  description: string;
  type: ModelType;
  file: File | null;
  url: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  icon?: string;
}> = ({ label, description, type, file, url, onChange, accept = ".fbx", icon = "fa-cube" }) => {
  // Check if we're using the default asset
  const isUsingDefault = !file && url;
  return (
  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center justify-between hover:border-indigo-500/50 transition-colors">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${file ? 'bg-green-500' : isUsingDefault ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
        <h3 className="font-semibold text-slate-200 capitalize">{label}</h3>
      </div>
      <p className="text-xs text-slate-400">{description}</p>
      {file && <p className="text-xs text-green-400 mt-1 font-mono">{file.name}</p>}
      {isUsingDefault && <p className="text-xs text-blue-400 mt-1 font-mono">Using default asset</p>}
    </div>
    <div className="ml-4">
      <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm transition-colors border border-slate-600">
        <i className={`fa-solid ${icon} mr-2`}></i> Select
        <input 
          type="file" 
          accept={accept}
          className="hidden" 
          onChange={onChange}
        />
      </label>
    </div>
  </div>
  );
};

export default function UploadPanel({ files, onFileChange, onProceed, ready, hasCache, onUseCache }: Props) {
  const [showCacheModal, setShowCacheModal] = useState(false);
  
  const getFile = (type: ModelType) => files.find(f => f.type === type)?.file || null;
  const getUrl = (type: ModelType) => files.find(f => f.type === type)?.url || null;
  
  const hasSomeFiles = files.some(f => f.file !== null);
  
  // Check if we're using any default assets
  const usingDefaults = files.some(f => !f.file && f.url);

  const handleMainButtonClick = () => {
    if (ready) {
      onProceed();
    } else if (hasCache) {
      setShowCacheModal(true);
    }
  };

  const handleConfirmCache = () => {
    onUseCache();
    setShowCacheModal(false);
  };

  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Upload Assets</h2>
        <p className="text-slate-400">
          Upload character FBX files and optional Wall images (.webp/.png) to customize the scene.
          <span className="block mt-2 text-sm text-blue-400">💡 Tip: Default assets are already loaded. You can upload custom files or proceed directly!</span>
        </p>
      </div>

      <div className="space-y-6">
        {/* Models Section */}
        <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Character Models (FBX)</h3>
            <div className="grid gap-3">
                <InputCard 
                label="Base Model (Mesh)" 
                description="The main character model with T-Pose or Idle (Required)."
                type={ModelType.BASE}
                file={getFile(ModelType.BASE)}
                url={getUrl(ModelType.BASE)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.BASE, e.target.files[0])}
                />
                <InputCard 
                label="Idle Animation" 
                description="Looping idle breathing animation."
                type={ModelType.IDLE}
                file={getFile(ModelType.IDLE)}
                url={getUrl(ModelType.IDLE)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.IDLE, e.target.files[0])}
                />
                <InputCard 
                label="Walk Animation" 
                description="Standard walking loop."
                type={ModelType.WALK}
                file={getFile(ModelType.WALK)}
                url={getUrl(ModelType.WALK)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.WALK, e.target.files[0])}
                />
                <InputCard 
                label="Run Animation" 
                description="Fast running loop."
                type={ModelType.RUN}
                file={getFile(ModelType.RUN)}
                url={getUrl(ModelType.RUN)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.RUN, e.target.files[0])}
                />
                <InputCard 
                label="Dance Animation" 
                description="A dance move sequence."
                type={ModelType.DANCE}
                file={getFile(ModelType.DANCE)}
                url={getUrl(ModelType.DANCE)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.DANCE, e.target.files[0])}
                />
            </div>
        </div>
        
        {/* Scenery Section */}
        <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Scene Customization (Optional)</h3>
            <div className="grid gap-3">
                <InputCard 
                label="Wall Background (Image B)" 
                description="Base background image for the signature wall."
                type={ModelType.WALL_BG}
                file={getFile(ModelType.WALL_BG)}
                url={getUrl(ModelType.WALL_BG)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.WALL_BG, e.target.files[0])}
                accept="image/webp, image/png, image/jpeg"
                icon="fa-image"
                />
                <InputCard 
                label="Wall Foreground (Image A)" 
                description="Overlay image (e.g., logo, frame) stacked on top."
                type={ModelType.WALL_FG}
                file={getFile(ModelType.WALL_FG)}
                url={getUrl(ModelType.WALL_FG)}
                onChange={(e) => e.target.files?.[0] && onFileChange(ModelType.WALL_FG, e.target.files[0])}
                accept="image/webp, image/png, image/jpeg"
                icon="fa-layer-group"
                />
            </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={handleMainButtonClick}
          disabled={!ready && !hasCache}
          className={`px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${
            (ready || hasCache)
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {ready ? (
            usingDefaults ? (
              <>
                Use Defaults & Load <i className="fa-solid fa-arrow-right"></i>
              </>
            ) : (
              <>
                Analyze & Load <i className="fa-solid fa-arrow-right"></i>
              </>
            )
          ) : hasCache ? (
            <>
              <i className="fa-solid fa-clock-rotate-left"></i> Use Previous / Proceed
            </>
          ) : (
             <>
              Upload Base Model to Proceed
            </>
          )}
        </button>
      </div>

      {/* Cache Confirmation Modal */}
      {showCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCacheModal(false)}></div>
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-4 text-white">
              <i className="fa-solid fa-circle-info text-indigo-400 mr-2"></i>
              提示
            </h3>
            
            <p className="text-slate-300 mb-8 leading-relaxed">
              {hasSomeFiles 
                ? "本次模型不完整，请【取消】继续补充或者【确认】全部采用上次的模型"
                : "未上传模型，【确认】本次将沿用上次的模型"
              }
            </p>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCacheModal(false)}
                className="px-4 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleConfirmCache}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}