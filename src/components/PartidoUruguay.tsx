import { AntelTVPlayer } from "./AntelTVPlayer.tsx";

interface PartidoUruguayProps {
    isUruguayCountry: boolean;
}

export const PartidoUruguay = ({ isUruguayCountry }: PartidoUruguayProps) => {
    if (!isUruguayCountry) {
        return null;
    }

    return (
        <div className="relative w-full h-full bg-black">
            <AntelTVPlayer />
        </div>
    );
};