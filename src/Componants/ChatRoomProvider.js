import React, { createContext, useState, useContext } from 'react';
//AlertMessageList -> CustomForm이 열리는 것을 관여

const ChatRoomContext = createContext();

export const useChatRoom = () => {
    return useContext(ChatRoomContext);
};

export const ChatRoomProvider = ({ children }) => {
    const [selectedChatRoom, setSelectedChatRoom] = useState(null);

    return (
        <ChatRoomContext.Provider value={{ selectedChatRoom, setSelectedChatRoom }}>
            {children}
        </ChatRoomContext.Provider>
    );
};
