import { AntelTVPlayer } from "./AntelTVPlayer.tsx";

interface PartidoUruguayProps {
    isAntelISP: boolean;
}

export const PartidoUruguay = ({ isAntelISP }: PartidoUruguayProps) => {
    if (!isAntelISP) {
        return null;
    }

    return (
        <div className="relative w-full h-full bg-black">
            <AntelTVPlayer />
        </div>
    );
};