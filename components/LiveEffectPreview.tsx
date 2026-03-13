import React from "react";
import CardImage from "./common/CardImage";
import { UltraRareGlow } from "./UltraRareGlow";
import { ShatterfoilOverlay } from "./ShatterfoilOverlay";

interface LiveEffectPreviewProps {
    type: 'CARD_EFFECT' | 'ICON_EFFECT';
    metadata: any;
    className?: string;
}

// A standard card from our database to use as a model for previews
const PREVIEW_CARD = {
    id: "d453703d-b264-4284-8c2e-75811c77f066",
    konamiId: 89631139,
    name: "Blue-Eyes White Dragon",
    variant: "TCG",
    artworks: [
        {
            id: 89631139,
            image_url: "https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/full_tcg/89631139.jpg",
            image_url_small: "https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/small_tcg/89631139.jpg",
            image_url_cropped: "https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/cropped_tcg/89631139.jpg"
        }
    ]
};

export const LiveEffectPreview: React.FC<LiveEffectPreviewProps> = ({ type, metadata, className = "" }) => {
    const variant = metadata?.variant || metadata?.component;

    if (type === 'CARD_EFFECT') {
        return (
            <div className={`relative w-full h-full flex items-center justify-center p-4 bg-zinc-900/50 rounded-2xl overflow-hidden ${className}`}>
                <div className="relative w-3/4 aspect-[1/1.45] shadow-2xl">
                    <CardImage 
                        card={PREVIEW_CARD} 
                        useLootArt={true}
                        className="w-full h-full object-contain rounded-sm"
                    />
                    
                    {(variant === "UltraRareGlow" || variant === "UR_GLOW") && <UltraRareGlow />}
                    {(variant === "ShatterfoilOverlay" || variant === "SHATTERFOIL") && <ShatterfoilOverlay />}
                </div>

                {/* Visual indicator that this is a live preview */}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600/80 rounded text-[8px] font-black uppercase tracking-widest text-white z-50">
                    Live Preview
                </div>
            </div>
        );
    }

    if (type === 'ICON_EFFECT') {
        return (
            <div className={`relative w-full h-full flex items-center justify-center bg-zinc-900/50 rounded-2xl overflow-hidden ${className}`}>
                <div className="relative w-40 h-40">
                    <div className="relative w-full h-full rounded-full border-2 border-white/20 overflow-hidden shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.05]">
                        <img 
                            src={PREVIEW_CARD.artworks[0].image_url_cropped} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                        />
                        
                        {/* Only Shatterfoil for Icons */}
                        <div className="absolute inset-0 pointer-events-none rounded-full overflow-hidden">
                            {(variant === "ShatterfoilOverlay" || variant === "SHATTERFOIL") && <ShatterfoilOverlay />}
                        </div>
                    </div>
                </div>

                {/* Visual indicator that this is a live preview */}
                <div className="absolute top-4 right-4 px-3 py-1 bg-blue-600/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white z-50 border border-white/20 shadow-lg shadow-blue-500/20">
                    Live Preview
                </div>
            </div>
        );
    }

    return null;
};
