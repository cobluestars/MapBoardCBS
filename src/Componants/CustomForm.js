import React, { useState, useEffect } from 'react';
import { getTempMarkerPosition, saveTempMarkerPosition, deleteTempMarkerPosition } from './TempMarkers';
import { getStorage, deleteObject, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDocs, updateDoc, getDoc, deleteDoc, collection, query, where, getFirestore, runTransaction, arrayRemove } from 'firebase/firestore';

const db = getFirestore();

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
    mediaURL: []
  };

  const isDataInitialState = JSON.stringify(data) === JSON.stringify(initialState);

  const [markerMode, setMarkerMode] = useState(isDataInitialState ? 'register' : 'view');

  const [formData, setFormData] = useState({
    ...initialState,
    mode: isDataInitialState ? 'register' : 'view',
    position: data ? data.position : null,
    userId: data ? data.userId : null,  // data 객체의 userId 값을 초기 userId 값으로 설정
    mediaURL: data && Array.isArray(data.mediaURL) ? data.mediaURL : []
});

  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaURLs, setMediaURLs] = useState([]);

  const [activeUploadTasks, setActiveUploadTasks] = useState([]); //image 업로드 취소
  
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
    // 이전 formData의 mediaURL을 mediaURLs 상태에 반영
    setMediaURLs(formData.mediaURL);
  };

  const handleFilesChange = (e) => {
    const newFiles = Array.from(e.target.files);

    if (newFiles.length + mediaFiles.length <= 4) {
        const previewURLs = newFiles.map(file => 
            URL.createObjectURL(file)
        );

        // 이전의 미리보기 URL과 새로운 미리보기 URL을 합침
        setMediaURLs(prevURLs =>   Array.isArray(prevURLs) 
        ? [...prevURLs, ...previewURLs] 
        : [...previewURLs]
        );
        setMediaFiles(prevFiles => [...prevFiles, ...newFiles]);
    } else {
        alert("최대 4개의 파일만 업로드할 수 있습니다.");
    }
};

  const uploadMedias = async () => {
    const urls = [];
    const currentUploadTasks = [];

    for (const file of mediaFiles) {
        if (!file || !file.name) {
            continue; // 파일 이름이 없는 경우 건너뜀.
        }

        const storage = getStorage();
        const storageRef = ref(storage, 'uploads/' + file.name);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        currentUploadTasks.push(uploadTask);

        try {
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                }, reject, resolve);
            });

            //storage에서 url 직접 가져옴
            const downloadURL = await getDownloadURL(storageRef);
            console.log("Download URL:", downloadURL);
            urls.push(downloadURL);
          } catch (error) {
              console.error("Error uploading file:", error);
          }
      }

      setActiveUploadTasks(currentUploadTasks);  // 마지막에 상태 업데이트
      setMediaURLs(urls);
      return urls;
  };

  //  url추가할 시, 유튜브 동영상 업로드 가능
  function extractVideoID(url) {
      const videoIDRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([^&\s]+)/;
      const match = url.match(videoIDRegex);
      return match ? match[1] : null;
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

  function ImageGrid({ mediaURLs, onImageClick }) {
    if (!Array.isArray(mediaURLs)) {
        return null;
    }
    if (mediaURLs.length <= 2) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mediaURLs.map((url, index) => (
                    <img 
                    key={index} 
                    src={url} 
                    alt={`Content ${index}`} 
                    style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                    onClick={() => onImageClick && onImageClick(index)} 
                    />
                ))}
            </div>
        );
    } else if (mediaURLs.length === 3) {
        return (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                {mediaURLs.map((url, index) => (
                    <img 
                    key={index} 
                    src={url} 
                    alt={`Content ${index}`} 
                    style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                    onClick={() => onImageClick && onImageClick(index)}  
                    />
                ))}
            </div>
        );
    } else if (mediaURLs.length === 4) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {mediaURLs.map((url, index) => (
                    <img 
                    key={index} 
                    src={url} 
                    alt={`Content ${index}`} 
                    style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                    onClick={() => onImageClick && onImageClick(index)}  
                    />
                ))}
            </div>
        );
    }
    return null;
}

const handleImageClick = async (index) => {
  //register/update 모드에서 이미지 업로드 취소 기능

  const removedURL = mediaURLs[index];

  // 이미지의 업로드 작업 취소 (만약 진행 중이라면)
  const task = activeUploadTasks[index];
  if (task) {
      task.cancel();
  }

  // `mediaFiles` 및 `mediaURLs`에서 해당 이미지를 제거
  // 수정 버튼을 눌러 수정 작업을 완료해야 DB에 반영됨
  setMediaFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      updatedFiles.splice(index, 1);
      return updatedFiles;
  });

  setMediaURLs(prevURLs => {
      const updatedURLs = [...prevURLs];
      updatedURLs.splice(index, 1);
      return updatedURLs;
  });

  // 이미지가 Firestore에 존재하면 삭제
  if (formData.mediaURL && formData.mediaURL.includes(removedURL)) {
    await removeURLFromMarkerMediaURLs(markerId, removedURL); // 먼저 Firestore에서 URL 제거
    await deleteImageFromStorage(removedURL);  // 그 후 Storage에서 이미지 삭제
    
    // 사용자가 이미지를 삭제할 때, 관련된 상태 값을 업데이트하는 로직
    // 1. 현재 mediaURLs 상태에서 삭제하려는 이미지의 URL을 제거
    setMediaURLs(prevURLs => {
      // filter 메서드를 사용하여 removedURL과 일치하지 않는 URL만 새 배열에 포함
      return prevURLs.filter(url => url !== removedURL);
    });

    // 2. formData의 mediaURL 필드에서 삭제하려는 이미지의 URL을 제거
    setFormData(prev => ({
      // 현재 formData의 다른 모든 필드를 그대로 복사
      ...prev,
      // mediaURL 필드만 업데이트
      mediaURL: prev.mediaURL.filter(url => url !== removedURL)
    }));
  } else {
    console.warn(`URL ${removedURL} not found in formData.mediaURL`);
  }
};

const removeURLFromMarkerMediaURLs = async (markerId, urlToRemove) => {
  try {
      // Firestore의 트랜잭션을 사용하여 동시성 문제 방지
      await runTransaction(db, async (transaction) => {
          // 'markers' 컬렉션의 참조 생성
          const firebaseMarkersRef = collection(db, 'markers');
          // 특정 markerId를 가진 문서의 참조 생성
          const markerDocRef = doc(firebaseMarkersRef, markerId);
          // 트랜잭션 내에서 문서 데이터 가져오기
          const markerDoc = await transaction.get(markerDocRef);

          // 해당 문서가 Firestore에 존재하는지 확인
          if (!markerDoc.exists()) {
              console.warn(`Document with ID ${markerId} does not exist.`);
              throw new Error("Document does not exist");
          }

          // 문서 데이터에서 mediaURLs를 가져옴 (값이 없을 경우 빈 배열로 초기화)
          const currentMediaURLs = markerDoc.data().mediaURL || [];

          // 삭제하려는 URL이 mediaURLs 배열에 존재하는지 확인
          if (currentMediaURLs.includes(urlToRemove)) {
              // URL이 존재한다면, 해당 URL을 mediaURL 배열에서 제거
              transaction.update(markerDocRef, {
                  mediaURL: arrayRemove(urlToRemove)
              });
          } else {
              // URL이 존재하지 않는다면, 경고 메시지 로깅
              console.warn(`URL ${urlToRemove} not found in mediaURLs`);
          }
      });
  } catch (error) {
      // 트랜잭션 중 에러 발생 시, 에러 로깅
      console.warn(`URL ${urlToRemove} not found in mediaURLs for marker with ID ${markerId}`);
  }
};

// 이미지 삭제: 더 이상 마커들에 포함되어 있지 않을 이미지를 Storage에서 삭제
const deleteImageFromStorage = async (url) => {
  //storage에서 MediaURL 삭제
  const storage = getStorage();
  const imageRef = ref(storage, url);

  try {
      await getDownloadURL(imageRef); // 이 이미지가 실제로 존재하는지 확인
      await deleteObject(imageRef);
  } catch (error) {
      if (error.code === "storage/object-not-found") {
          console.warn(`Image not found in storage: ${url}`);
      } else {
          console.error("Failed to delete image from storage:", error);
      }
  }
};

const handleRegisterOrUpdate = async () => {
  if (
    markerMode === 'register' &&
    (!formData.title ||
      !formData.content ||
      formData.category === '무엇을 할 것인지 선택하세요' ||
      !formData.startDate ||
      !formData.endDate)
  ) {
    alert('무엇을 할 것인지 구체적으로 알려주세요.');
    return;
  }

    try {
      
      let mediaURLs = formData.mediaURL || []; // 기본 값을 빈 배열로 설정
      // formData.mediaURL이 배열이 아니라면 배열로 변환
      if (!Array.isArray(mediaURLs)) {
          mediaURLs = [mediaURLs];
      }

    // 파일 업로드 함수 호출
    const newMediaURLs = await uploadMedias();

    // 기존의 mediaURL과 새로운 mediaURLs를 병합
    const combinedMediaURLs = [...mediaURLs, ...newMediaURLs];

    const updatedFormState = await registerHandler({ 
        ...formData, 
        mediaURL: combinedMediaURLs 
    });

    setFormData(prev => ({
      ...prev,
      mediaURL: updatedFormState.mediaURL || [],
      ...updatedFormState
    }));
  
    setMediaURLs(combinedMediaURLs); // 병합된 URL로 상태 업데이트

    setMarkerMode('view'); // registration/update 이후 view 모드로 변경

    handleClose();

    // Firestore에서 임시 마커의 위치 데이터를 삭제
    await deleteTempMarkerPosition();
  } catch (error) {
    console.error('Error during registration or update:', error);
  }
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
            {extractVideoID(formData.content) ? (
                <iframe
                    src={`https://www.youtube.com/embed/${extractVideoID(formData.content)}`}
                    frameBorder="0"
                    allowFullScreen
                    title="YouTube Video"
                ></iframe>
            ) : (
                <p>{formData.content}</p>
            )}
          </div>
          <div>
            <label>이미지&동영상</label>
                <ImageGrid mediaURLs={formData.mediaURL} />
            {/* {Array.isArray(formData.mediaURL) && formData.mediaURL.map((url) => (
                <div key={url}>
                    {formData.mediaURL && <ImageGrid mediaURLs={formData.mediaURL} />}
                </div>
              ))} */}
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
              <label>이미지&동영상</label>
                <p>최대 4개까지 업로드 가능</p>
                  <input type="file" multiple onChange={handleFilesChange} />
                  <ImageGrid mediaURLs={mediaURLs} onImageClick={handleImageClick} />
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