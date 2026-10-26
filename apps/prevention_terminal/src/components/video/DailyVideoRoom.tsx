import React, { useEffect, useRef, useState } from 'react';
// import DailyIframe from '@daily-co/daily-js'; // Необходимо установить `npm i @daily-co/daily-js`

interface DailyVideoRoomProps {
    url: string;
    onLeave?: () => void;
}

export const DailyVideoRoom: React.FC<DailyVideoRoomProps> = ({ url, onLeave }) => {
    const videoContainer = useRef<HTMLDivElement>(null);
    const [callObject, setCallObject] = useState<any>(null);

    useEffect(() => {
        if (!videoContainer.current) return;
        
        // В реальном проекте используем:
        // const callFrame = DailyIframe.createFrame(videoContainer.current, {
        //     showLeaveButton: true,
        //     iframeStyle: {
        //         width: '100%',
        //         height: '100%',
        //         border: '0',
        //     },
        // });
        // setCallObject(callFrame);
        // callFrame.join({ url });
        
        // callFrame.on('left-meeting', () => {
        //     callFrame.destroy();
        //     if (onLeave) onLeave();
        // });

        // Заглушка, пока не установлен пакет
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
        videoContainer.current.appendChild(iframe);

        return () => {
            // if (callFrame) callFrame.destroy();
            if (videoContainer.current) {
                videoContainer.current.innerHTML = '';
            }
        };
    }, [url, onLeave]);

    return (
        <div style={{ width: '100%', height: '600px', backgroundColor: '#000' }} ref={videoContainer}>
            {/* Daily.co iframe will be injected here */}
        </div>
    );
};
