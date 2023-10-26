import React, {useMemo} from 'react';
import { useSelector } from 'react-redux';
import { ChatBubble } from './ChatModal'; 
import { useChatRoom } from './ChatRoomProvider';

import './AlertMessageList.css';

function AlertMessageList({ currentUserEmail, markerOwnerEmail }) {
    const messages = useSelector(state => state.AlertMessage.messages);

    const { setSelectedChatRoom } = useChatRoom();

    // 메시지를 주소별로 그룹화
    const groupedMessages = useMemo(() => {
      return messages.reduce((acc, curr) => {
        if (!curr.senderEmail || !curr.text || !curr.sendAt || !curr.chatid) {
          // 필요한 값들 중 하나라도 없으면 이 메시지는 포함되지 않음
          return acc;
        }
    
        const key = `${curr?.roadAddress} ${curr?.jibunAddress} ${curr?.chatid}`;
        if (!acc[key]) {
          acc[key] = {
            roadAddress: curr.roadAddress,
            jibunAddress: curr.jibunAddress,
            chatid: curr.chatid,
            messages: []
          };
        }
        acc[key].messages.push(curr);
        return acc;
      }, {});
    }, [messages]); // messages가 변경될 때만 다시 카운트

    if (!messages || !Array.isArray(messages)) return null;


    const handleChatRoomClick = (group) => {
      // console.log("Chat room clicked!", group);
        setSelectedChatRoom(group);
      // 클릭된 채팅방의 정보를 전달하여 지도 이동 및 customform 열기
    };    

  return (
    <div className="messageListModal">
      <label className='MessagesList'>메시지 리스트</label>
      <p>채팅방 혹은 메세지 클릭 시, 해당 마커로 이동합니다.</p>
      <hr />

      {Object.values(groupedMessages).map((group, index) => (
        <div 
          key={index}
          onClick={() => handleChatRoomClick(group)}
          className='ChatRoomList'
        >
          <hr />
          <br />
          <h4 className='ChatRoomIndex'>채팅방{index + 1}<br /> [{group.roadAddress}],<br />[{group.jibunAddress}]</h4>
          <br />
          <hr />
          <br />
          {group.messages.map((message, idx) => (
            <ChatBubble
              className='chatbubble' 
              key={idx} 
              senderEmail={message.senderEmail}
              text={message.text}
              sendAt={message.sendAt}
              // 현재 사용자와 메시지의 주인이 동일한지 여부를 결정
              isMine={message.senderEmail === currentUserEmail} 
              isOwner={message.senderEmail === markerOwnerEmail} 
              roadAddress={group.roadAddress}
              jibunAddress={group.jibunAddress}
              chatid={group.chatid}
            />
          ))}
        </div>
      ))}
      <hr />
    </div>
  );
}

export default AlertMessageList;
