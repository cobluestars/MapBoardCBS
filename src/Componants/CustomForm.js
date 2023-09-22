import React, { useState, useEffect } from 'react';

const CustomForm = ({ style, data, registerHandler, onClose }) => {

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
  });

  useEffect(() => {
    // 데이터가 주어진 경우 기존 데이터로 초기화
    setFormData((prevState) => ({
      ...prevState,
      ...data,
      mode: 'view',
    }));
  }, [data]);

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

    // registerHandler를 호출하고 업데이트된 데이터를 기존 formData에 반영합니다.
    const updatedFormState = await registerHandler({ ...formData });
    setFormData((prevData) => ({
      ...prevData,
      ...updatedFormState
    }));
    setMarkerMode('view'); // registration/update 이후 view 모드로 변경
    handleClose();
  };

  const handleEdit = () => {
    switchToUpdateMode(); // 수정 모드로 변경
  };

  const handleClose = () => {
    onClose();
  };

  const handleCancel = () => {
    setMarkerMode('view'); // 취소 버튼을 누르면 view 모드로 변경
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
          <button onClick={handleEdit}>수정</button>
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