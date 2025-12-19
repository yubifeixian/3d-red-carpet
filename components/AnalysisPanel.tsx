import React, { useEffect, useState } from 'react';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ModelFile, ModelType } from '../types';

interface Props {
  files: ModelFile[];
  onComplete: () => void;
  onBack: () => void;
}

interface AnalysisItem {
  name: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  details?: string;
}

export default function AnalysisPanel({ files, onComplete, onBack }: Props) {
  const [items, setItems] = useState<AnalysisItem[]>(
    files.map(f => ({ name: f.type, status: 'pending' }))
  );
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fbxLoader = new FBXLoader();
    const gltfLoader = new GLTFLoader();

    // Helper function to determine model format from URL or File
    const getModelFormat = (url: string, file?: File) => {
      if (file) {
          const name = file.name.toLowerCase();
          if (name.endsWith('.glb')) return 'glb';
          if (name.endsWith('.fbx')) return 'fbx';
      }
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith('.glb')) return 'glb';
      if (lowerUrl.endsWith('.fbx')) return 'fbx';
      return 'unknown';
    };

    const analyzeFiles = async () => {
      let completedCount = 0;

      for (let i = 0; i < files.length; i++) {
        if (!mounted) return;
        
        const file = files[i];
        
        // Update status to analyzing
        setItems(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'analyzing' } : item
        ));

        try {
           // Determine if we're using a URL or an uploaded file
           const useUrl = !!file.url;
           const useUploadedFile = !!file.file;
           
           if (useUrl || useUploadedFile) {
             // Handle Images (Wall Backgrounds) differently from 3D models
             if (file.type === ModelType.WALL_BG || file.type === ModelType.WALL_FG) {
                // Just assume images are valid if URL or file exists
                if (mounted) {
                    setItems(prev => prev.map((item, idx) => 
                        idx === i ? { ...item, status: 'complete', details: 'Image Loaded' } : item
                    ));
                }
             } else {
                 // Handle 3D models based on their format
                 let modelUrl;
                 
                 if (useUrl) {
                     modelUrl = file.url!;
                 } else {
                     // Create a temporary URL for the uploaded file
                     modelUrl = URL.createObjectURL(file.file!);
                 }
                 
                 const modelFormat = getModelFormat(modelUrl, file.file || undefined);
                 let object;
                 
                 if (modelFormat === 'glb') {
                    // Handle GLB
                    const gltf = await gltfLoader.loadAsync(modelUrl);
                    object = gltf.scene;
                 } else if (modelFormat === 'fbx') {
                    // Handle FBX
                    object = await fbxLoader.loadAsync(modelUrl);
                 } else {
                    throw new Error('Unsupported model format');
                 }
                 
                 // Clean up temporary URL ONLY if we created one (i.e., we didn't use an existing URL)
                 if (!useUrl && useUploadedFile) {
                     URL.revokeObjectURL(modelUrl);
                 }
                 
                 let details = "";
                 if ((object as any).animations && (object as any).animations.length > 0) {
                    const duration = (object as any).animations[0].duration.toFixed(2);
                    details = `Animation Duration: ${duration}s`;
                 } else {
                    let boneCount = 0;
                    object.traverse((child: any) => {
                        if (child.type === 'Bone') boneCount++;
                    });
                    details = `Skeleton found: ${boneCount} bones`;
                }
    
                 if (mounted) {
                    setItems(prev => prev.map((item, idx) => 
                        idx === i ? { ...item, status: 'complete', details } : item
                    ));
                 }
             }
           } else {
             // No file uploaded for this slot, verify if it's optional
             if (mounted) {
                 setItems(prev => prev.map((item, idx) => 
                    idx === i ? { ...item, status: 'complete', details: 'Skipped (Optional)' } : item
                 ));
             }
           }
        } catch (e) {
            console.error(e);
            if (mounted) {
                setItems(prev => prev.map((item, idx) => 
                    idx === i ? { ...item, status: 'error', details: 'Failed to parse file' } : item
                ));
            }
        }
        
        completedCount++;
        if (mounted) setProgress((completedCount / files.length) * 100);
        
        // Reduced delay on mobile for better performance
        const delay = window.innerWidth < 768 ? 100 : 400;
        await new Promise(r => setTimeout(r, delay));
      }

      if (mounted) {
        setTimeout(onComplete, 800);
      }
    };

    analyzeFiles();

    return () => { mounted = false; };
  }, [files, onComplete]);

  return (
    <div className="w-full max-w-xl text-center pt-12">
        <h2 className="text-2xl font-bold mb-8">Analyzing Assets...</h2>
        
        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl mb-8">
            <div className="h-2 bg-slate-700 w-full">
                <div 
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="p-6 space-y-4">
                {items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded bg-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="w-6 flex justify-center">
                                {item.status === 'pending' && <i className="fa-regular fa-circle text-slate-500"></i>}
                                {item.status === 'analyzing' && <i className="fa-solid fa-spinner fa-spin text-indigo-400"></i>}
                                {item.status === 'complete' && <i className="fa-solid fa-check text-green-400"></i>}
                                {item.status === 'error' && <i className="fa-solid fa-triangle-exclamation text-red-400"></i>}
                            </div>
                            <span className="capitalize font-medium">{item.name.replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{item.details}</span>
                    </div>
                ))}
            </div>
        </div>

        <button onClick={onBack} className="text-slate-500 hover:text-white text-sm">
            Cancel
        </button>
    </div>
  );
}