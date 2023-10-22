import React, {useMemo} from 'react';
import { useSelector } from 'react-redux';
import { ChatBubble } from './ChatModal'; 

function AlertMessageList({ onClickChatRoom, currentUserEmail, markerOwnerEmail }) {
    const messages = useSelector(state => state.AlertMessage.messages);
  
    // 메시지를 주소별로 그룹화
    const groupedMessages = useMemo(() => {
      return messages.reduce((acc, curr) => {
        if (!curr.senderEmail || !curr.text || !curr.sendAt) {
          // 필요한 값들 중 하나라도 없으면 이 메시지는 포함되지 않음
          return acc;
        }
  
        const key = `${curr?.roadAddress} ${curr?.jibunAddress}`;
        if (!acc[key]) {
          acc[key] = {
            roadAddress: curr.roadAddress,
            jibunAddress: curr.jibunAddress,
            messages: []
          };
        }
        acc[key].messages.push(curr);
        return acc;
      }, {});
    }, [messages]); // messages가 변경될 때만 다시 카운트

        if (!messages || !Array.isArray(messages)) return null;

  return (
    <div className="messageListModal">
        <label className='MessageList'>메시지 리스트</label>
          <hr />
      {Object.values(groupedMessages).map((group, index) => (
        <div key={index} onClick={() => onClickChatRoom(group.messages)}>
          <h4>채팅방{index + 1} [{group.roadAddress} {group.jibunAddress}]</h4>
          {group.messages.map((message, idx) => (
            <ChatBubble 
              key={idx} 
              senderEmail={message.senderEmail}
              text={message.text}
              sendAt={message.sendAt}
              // 현재 사용자와 메시지의 주인이 동일한지 여부를 결정
              isMine={message.senderEmail === currentUserEmail} 
              isOwner={message.senderEmail === markerOwnerEmail} 
              roadAddress={group.roadAddress}
              jibunAddress={group.jibunAddress}
            />
          ))}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default AlertMessageList;
