import { AntelTVPlayer } from "./AntelTVPlayer.tsx";

interface PartidoUruguayProps {
    isUruguayCountry: boolean;
    isAntelISP: boolean;
}

export const PartidoUruguay = ({ isUruguayCountry, isAntelISP }: PartidoUruguayProps) => {
    if (!isUruguayCountry) {
        return null;
    }

    if (!isAntelISP) {
        return (
            <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-sm text-white/40 font-mono">
                    Partido en vivo solo disponible para usuarios de Antel en Uruguay
                </p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-black">
            <AntelTVPlayer />
        </div>
    );
};