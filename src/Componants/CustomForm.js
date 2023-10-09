import React, { useState, useEffect } from 'react';
import { getTempMarkerPosition, saveTempMarkerPosition, deleteTempMarkerPosition } from './TempMarkers';

const CustomForm = ({
  style, 
  data, 
  registerHandler, 
  onClose, 
  onDelete, 
  markerId, 
  user, 
  userId, 
  enableEditing, 
  showBasicInfo  
}) => {
  
  const initialState = {
    title: "",
    content: "",
    category: "무엇을 할 것인지 선택하세요",
    startDate: "",
    endDate: "",
  };

  const isDataInitialState = JSON.stringify(data) === JSON.stringify(initialState);

  const [markerMode, setMarkerMode] = useState(isDataInitialState ? 'register' : 'view');

  const [formData, setFormData] = useState({
    ...initialState,
    mode: isDataInitialState ? 'register' : 'view',
    position: data ? data.position : null,
    userId: data ? data.userId : null  // data 객체의 userId 값을 초기 userId 값으로 설정
  });

    useEffect(() => {
      setFormData(data);
  }, [data]);

  const isOwner = user && user.uid === formData.userId;

  useEffect(() => {
      const fetchTempMarkerPosition = async () => {
          const position = await getTempMarkerPosition();
          if (position) {
              setFormData(prev => ({ ...prev, position })); // 데이터가 주어진 경우 기존 데이터로 초기화
          }
      };

      fetchTempMarkerPosition();
  }, []);

  useEffect(() => {
    // 현재 사용자의 userId와 마커의 userId가 같은 경우, 수정/삭제 기능을 활성화
    if (isOwner) {
      enableEditing();
    } else {
      showBasicInfo();
    }
  }, [isOwner, enableEditing, showBasicInfo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({ ...prevState, [name]: value }));
  };

  const switchToRegisterMode = () => {
    setMarkerMode('register');
  };

  const switchToViewMode = () => {
    setMarkerMode('view');
  };

  const switchToUpdateMode = () => {
    setMarkerMode('update');
  };

  const handleRegisterOrUpdate = async () => {
    if (markerMode === 'register' && (!formData.title || !formData.content || formData.category === '무엇을 할 것인지 선택하세요' || !formData.startDate || !formData.endDate)) {
      alert('무엇을 할 것인지 구체적으로 알려주세요.');
      return;
    }

    const updatedFormState = await registerHandler({ ...formData });
    setFormData((prevData) => ({
      ...prevData,
      ...updatedFormState
    }));
    setMarkerMode('view');  // registration/update 이후 view 모드로 변경

    handleClose();

    // Firestore에서 임시 마커의 위치 데이터를 삭제
    await deleteTempMarkerPosition();
  };

  const handleEdit = () => {
    switchToUpdateMode();
  };

  const handleClose = () => {
    onClose();
  };

  const handleCancel = () => {
    setMarkerMode('view');
  };

  return (
    <div className="custom_form" style={style}>
      <h2>상세 정보</h2>
      <br />
      {markerMode === 'view' ? (
        // View 모드에서는 데이터를 출력
        <>
          <div>
            <label>제목</label>
            <p>{formData.title}</p>
          </div>
          <div>
            <label>내용</label>
            <p>{formData.content}</p>
          </div>
          <div>
            <label>카테고리</label>
            <p>{formData.category}</p>
          </div>
          <div>
            <label>시작일</label>
            <p>{formData.startDate}</p>
          </div>
          <div>
            <label>종료일</label>
            <p>{formData.endDate}</p>
          </div>
          {isOwner && (
              <>
                  <button onClick={handleEdit}>수정</button>
                  <button onClick={() => onDelete(markerId)}>삭제</button>
              </>
          )}
          <button onClick={handleClose}>닫기</button>
        </>
      ) : (
        // Edit 또는 Register 모드에서는 입력 폼 표시
        <>
          <div>
            <label>제목</label>
            <input name="title" value={formData.title} onChange={handleInputChange} />
          </div>
          <div>
            <label>내용</label>
            <textarea name="content" value={formData.content} onChange={handleInputChange}></textarea>
          </div>
          <div>
            <label>카테고리</label>
            <select name="category" value={formData.category} onChange={handleInputChange}>
              <option value="무엇을 할 것인지 선택하세요">무엇을 할 것인지 선택하세요</option>
              <option value="알바">알바</option>
              <option value="프리랜서">프리랜서</option>
              <option value="직거래">직거래</option>
              <option value="심부름">심부름</option>
              <option value="과외">과외</option>
              <option value="청소">청소</option>
              <option value="대리인">대리인</option>
            </select>
          </div>
          <div>
            <label>시작일시</label>
            <input type="datetime-local" name="startDate" value={formData.startDate} onChange={handleInputChange} />
          </div>
          <div>
            <label>종료일시</label>
            <input type="datetime-local" name="endDate" value={formData.endDate} onChange={handleInputChange} />
          </div>
          <button onClick={handleRegisterOrUpdate}>{markerMode === 'register' ? '등록' : '수정'}</button>
          <button onClick={handleCancel}>취소</button>
        </>
      )}
    </div>
  );
};

export default CustomForm;


//customform css 꾸미기
//db.json 형태도 정상임.