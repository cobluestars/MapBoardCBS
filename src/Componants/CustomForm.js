import React, { useState, useEffect, useRef } from 'react';
import ImageModal from './ImageModal';
import { getTempMarkerPosition, saveTempMarkerPosition, deleteTempMarkerPosition } from './TempMarkers';
import { getStorage, deleteObject, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDocs, updateDoc, getDoc, deleteDoc, collection, query, where, getFirestore, runTransaction, arrayRemove } from 'firebase/firestore';
import './CustomForm.css';
import ChatModal from './ChatModal';

import { DateTime } from 'luxon';   //신뢰할 만한 타임스탬프

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
  showBasicInfo,
  chatid,
  position,
  roadAddress,
  jibunAddress,
  createdAt,
  email,
  currentemail
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

  const [isChatModalOpen, setChatModalOpen] = useState(false);
  //댓글 창 열고 닫기

  const handleChatModalOpen = () => {
    setChatModalOpen(true);
  };

  const handleChatModalClose = () => {
    setChatModalOpen(false);
  };

  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaURLs, setMediaURLs] = useState([]);

  const [activeUploadTasks, setActiveUploadTasks] = useState([]); //미디어파일 업로드 취소
  const fileInputRef = useRef(null);  //미디어파일 입력 요소에 대한 참조 생성

  // 모달의 열림 상태와 이미지 URL 상태 추가
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState({ urls: [], currentIndex: null });

  // 이미지 클릭 핸들러
  const handleThumbnailClick = (clickedSrc) => {
      const currentIndex = formData.mediaURL.indexOf(clickedSrc);
      setModalImageSrc({
          urls: formData.mediaURL,
          currentIndex,
          // clickedSrc
      });
      setModalOpen(true);
  };

  const handleModalClose = () => {
      setModalOpen(false);
  };

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

    /** 업로드파일 중복 확인 로직 */
    // 파일 자체의 중복 확인
    const hasDuplicateFile = newFiles.some(newFile => 
      mediaFiles.some(existingFile => 
          existingFile.name === newFile.name && existingFile.size === newFile.size
        )
    );

    // Blob URL(미리보기 파일)의 중복 확인
    const previewURLs = newFiles.map(file => URL.createObjectURL(file));
    const hasDuplicateURL = previewURLs.some(url => mediaURLs.includes(url));

    if (hasDuplicateFile || hasDuplicateURL) {
        alert("똑같은 파일이 있습니다. 다른 파일을 선택해주세요.");
        return;
    }

    if (newFiles.length + mediaFiles.length <= 4) {
        const previewURLs = newFiles.map(file => 
            URL.createObjectURL(file)
        );

        // 이전의 미리보기 URL과 새로운 미리보기 URL을 합침
        setMediaURLs(prevURLs => {
          return Array.isArray(prevURLs) ? [...prevURLs, ...previewURLs] : [...previewURLs];
      });
        
        setMediaFiles(prevFiles => {
          return [...prevFiles, ...newFiles];
      });

    } else {
        alert("최대 4개의 파일만 업로드할 수 있습니다.");
    }

    console.log("Selected files:", newFiles);
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

  const TimeLeftDisplay = ({ createdAt = { seconds: 0 } }) => {
    const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
    const ONE_MONTH_IN_MS = 30 * ONE_DAY_IN_MS;

    const currentTime = DateTime.now().toMillis();
    const createdAtMs = createdAt.seconds * 1000;
    const initialTimeLeft = ONE_MONTH_IN_MS - (currentTime - createdAtMs);

    const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1000);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const daysLeft = Math.floor(timeLeft / ONE_DAY_IN_MS);
    const hoursLeft = Math.floor((timeLeft % ONE_DAY_IN_MS) / (60 * 60 * 1000));
    const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const secondsLeft = Math.floor((timeLeft % (60 * 1000)) / 1000);

    if (timeLeft <= 0) {
      return <div style={{ color: 'red' }}>처리 대기 중인 마커입니다.</div>;
    }

    return (
        <div style={{ color: daysLeft <= 7 ? 'red' : 'black' }}>
            등록한 마커는 {daysLeft}일 {hoursLeft}시간 {minutesLeft}분 {secondsLeft}초 후에 삭제됩니다.
        </div>
    );
  };

  /**
   * Firebase Storage URL에서 미디어 파일 이름을 추출
   * @param {string} fullURL - 전체 Firebase Storage URL
   * @returns {string} 파일명
   */
  const extractFileNameFromFullURL = (fullURL) => {
    const match = fullURL.match(/%2F((?:[^?%]*%[0-9a-f]{2})*[^?%]*)\?/i);
    return match ? decodeURIComponent(match[1]) : null;
  };

  /**
  * Firebase Storage URL의 참조 횟수를 증가
  * @param {string} mediaURL - 전체 Firebase Storage URL
  */
  const incrementMediaReferenceCount = async (mediaURL) => {
    if (mediaURL.includes('firebasestorage.googleapis.com')) {  // Firebase Storage URL인지 확인
        const fileName = extractFileNameFromFullURL(mediaURL);  // 파일명 추출
        const docRef = doc(db, 'mediaReferences', fileName);
        await runTransaction(db, async (transaction) => {
            const docSnapshot = await transaction.get(docRef);
            if (docSnapshot.exists()) {
                const currentCount = docSnapshot.data().count || 0;
                transaction.update(docRef, { count: currentCount + 1 });
            } else {
                transaction.set(docRef, { count: 1 });
            }
        });
    }
  };

  /**
  * Firebase Storage URL의 참조 횟수를 감소시키고 참조되지 않으면 삭제
  * @param {string} mediaURL - 전체 Firebase Storage URL
  */
  const decrementAndRemoveMediaIfUnreferenced = async (mediaURL) => {
    if (mediaURL.includes('firebasestorage.googleapis.com')) {  // Firebase Storage URL인지 확인
        const fileName = extractFileNameFromFullURL(mediaURL);  // 파일명 추출
        const docRef = doc(db, 'mediaReferences', fileName);
        await runTransaction(db, async (transaction) => {
            const docSnapshot = await transaction.get(docRef);
            if (docSnapshot.exists()) {
                const currentCount = docSnapshot.data().count || 0;
                if (currentCount <= 1) {
                    transaction.delete(docRef);
                    
                    // 스토리지에서 이미지 삭제 시작
                    const storage = getStorage();
                    const imageRef = ref(storage, mediaURL);
                    try {
                        await getDownloadURL(imageRef); // 이 이미지가 실제로 존재하는지 확인
                        await deleteObject(imageRef);
                    } catch (error) {
                        if (error.code === "storage/object-not-found") {
                            console.warn(`Image not found in storage: ${mediaURL}`);
                        } else {
                            console.error("Failed to delete image from storage:", error);
                        }
                    }
                    // 스토리지에서 이미지 삭제 끝
                    
                } else {
                    transaction.update(docRef, { count: currentCount - 1 });
                }
            }
        });
      }
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

  const ImageGrid = ({ mediaURLs, onImageClick, mode }) => {
      // mediaURLs가 배열인지 확인
      const validMediaURLs = Array.isArray(mediaURLs) ? mediaURLs : [];

      const handleClick = (url, index) => {
        // console.log('Inside handleClick - url:', url);
        if (mode === 'view') {
            onImageClick(url);
        } else {
            onImageClick(index);
        }
      };
      
      if (validMediaURLs.length <= 2) {
          return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {validMediaURLs.map((url, index) => (
                    <div key={index} style={{ textAlign: 'center' }}>
                        <img 
                            src={url} 
                            alt={`Content ${index}`} 
                            style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                            onClick={() => handleClick(url, index)}  
                        />
                        {mode !== 'view' ? (
                        <div style={{ fontSize: '8px', marginTop: '5px' }}>{url}</div>
                        ) : null}
                    </div>
                  ))}
              </div>
          );
      } else if (validMediaURLs.length === 3) {
          return (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                  {validMediaURLs.map((url, index) => (
                    <div key={index} style={{ textAlign: 'center' }}>
                      <img 
                          src={url} 
                          alt={`Content ${index}`} 
                          style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                          onClick={() => handleClick(url, index)}  
                      />
                      {mode !== 'view' ? (
                      <div style={{ fontSize: '8px', marginTop: '5px' }}>{url}</div>
                      ) : null}
                    </div>
                  ))}
              </div>
          );
      } else if (validMediaURLs.length === 4) {
          return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {validMediaURLs.map((url, index) => (
                    <div key={index} style={{ textAlign: 'center' }}>
                      <img 
                          src={url} 
                          alt={`Content ${index}`} 
                          style={{ width: '100px', height: '100px', cursor: 'pointer' }} 
                          onClick={() => handleClick(url, index)}  
                      />
                      {mode !== 'view' ? (
                      <div style={{ fontSize: '8px', marginTop: '5px' }}>{url}</div>
                      ) : null}
                  </div>
                  ))}
              </div>
          );
      }

      return null;
  }

  const handleImageClick = async (index) => {
    
      //register/update 모드에서 이미지 업로드 취소 핸들러
      const removedURL = mediaURLs[index];

      // 이미지의 업로드 작업 취소 (만약 진행 중이라면)
      const task = activeUploadTasks[index];
      if (task) {
          task.cancel();
      }

      // 취소 후 파일 입력 요소의 값을 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      };

      // 먼저 Firestore에서 URL 제거
      if (formData.mediaURL && Array.isArray(formData.mediaURL)) {
        if (formData.mediaURL && formData.mediaURL.includes(removedURL)) {
          await removeURLFromMarkerMediaURLs(markerId, removedURL); 
          await decrementAndRemoveMediaIfUnreferenced(removedURL); 
        } else {
              //formData의 mediaURL에서 잘못된 blob URL 제거
              setFormData(prev => ({
              ...prev,
              mediaURL: prev.mediaURL.filter(url => url !== removedURL)
          }));      
          console.warn(`URL ${removedURL} not found in formData.mediaURL`);
        }
      }

      // `mediaFiles` 및 `mediaURLs`에서 해당 이미지를 제거
      // 수정 버튼을 눌러 수정 작업을 완료해야 DB에 반영됨
      setMediaFiles(prevFiles => {
          const updatedFiles = [...prevFiles];
          updatedFiles.splice(index, 1);
          return updatedFiles;
      });

      const updatedURLs = mediaURLs.filter(url => url !== removedURL);
      setMediaURLs(updatedURLs);

      // formData의 mediaURL 필드에서 삭제하려는 이미지의 URL을 제거
      setFormData(prev => ({
          // 현재 formData의 다른 모든 필드를 그대로 복사
          ...prev,
          // mediaURL 필드만 업데이트
          mediaURL: updatedURLs
      }));
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
            // } else {
                // URL이 존재하지 않는다면, 경고 메시지 로깅
                // console.warn(`URL ${urlToRemove} not found in mediaURLs`);
            }
        });
    } catch (error) {
        // 트랜잭션 중 에러 발생 시, 에러 로깅
        console.warn(`URL ${urlToRemove} not found in mediaURLs for marker with ID ${markerId}`);
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

      // 각 새로 업로드된 미디어의 참조 횟수 증가
      for (const newMediaURL of newMediaURLs) {
        await incrementMediaReferenceCount(newMediaURL);
      }

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
      <h2 className='Information_Detail'>상세 정보</h2>
      <hr className='hr1'/>
      {markerMode === 'view' ? (
        // View 모드에서는 데이터를 출력
        <>
          <div>
            <label className='title'>제목</label>
            <p>{formData.title}</p>
          </div>
          <div>
            <label className='content'>내용</label>
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
            <label className='mediaURL'>이미지&동영상</label>
            <ImageGrid mediaURLs={formData.mediaURL} onImageClick={markerMode === 'view' ? handleThumbnailClick : handleImageClick} mode={markerMode} />
          </div>
          <div>
            <label className='category'>카테고리</label>
            <p>{formData.category}</p>
          </div>
          <div>
            <label className='startDate'>시작일</label>
            <p>{formData.startDate}</p>
          </div>
          <div>
            <label className='endDate'>종료일</label>
            <p>{formData.endDate}</p>
          </div>
          {createdAt && (
            <div>
                <label className='createdAt'>등록 시간</label>
                <p>{new Date(createdAt.seconds * 1000).toLocaleString()}</p>
            </div>
          )}
          <TimeLeftDisplay createdAt={createdAt} />
          <hr className='hr2'/>
          <div>
            <label className='MarkerAddress'>주소 정보</label>
            { roadAddress === null ? null : <p>도로명주소: {roadAddress}</p>}
            <p>지번: {jibunAddress}</p>
          </div>
          <div>
              <label className='email'>ID</label>
              <p className='emailID'>{email}</p>
          </div>
          <hr className='hr3'/>
          <div className='buttons'>
          {isOwner && (
              <>
                  <button onClick={handleEdit}>수정</button>
                  <button onClick={() => onDelete(markerId)}>삭제</button>
              </>
          )}
          {user && (
            <>
                 <button onClick={handleChatModalOpen}>댓글</button>
            </>
          )}
          <ChatModal 
              isOpen={isChatModalOpen} 
              onClose={handleChatModalClose}
              currentemail={currentemail}
              markerOwnerEmail={email}
              chatid={chatid}
          />
          <button className='closebutton' onClick={handleClose}>닫기</button>
          </div>
          <ImageModal 
              isOpen={isModalOpen} 
              srcs={modalImageSrc.urls}
              currentImageIndex={modalImageSrc.currentIndex}
              onClose={handleModalClose}
          />
        </>
      ) : (
        // Update 또는 Register 모드에서는 입력 폼 표시
        <>
          <div>
            <label className='title'>제목</label>
            <input name="title" value={formData.title} onChange={handleInputChange} />
          </div>
          <div>
            <label className='content'>내용</label>
            <textarea name="content" value={formData.content} onChange={handleInputChange}></textarea>
          </div>
          <div>
            <label className='category'>카테고리</label>
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
              <label className='mediaURL'>이미지&동영상</label>
                <p className='maximum4media'>최대 4개까지 업로드 가능</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple onChange={handleFilesChange}
                  />
                  <ImageGrid 
                    mediaURLs={mediaURLs} 
                    validMediaURLs={formData.mediaURL}
                    onImageClick={markerMode === 'view' ? handleThumbnailClick : handleImageClick} 
                    mode={markerMode} 
                  />
          </div>
          <div>
            <label className='startDate'>시작일시</label>
            <input type="datetime-local" name="startDate" value={formData.startDate} onChange={handleInputChange} />
          </div>
          <div>
            <label className='endDate'>종료일시</label>
            <input type="datetime-local" name="endDate" value={formData.endDate} onChange={handleInputChange} />
          </div>
          <hr className='hr3'/>
          <div className='buttons'>
            <button onClick={handleRegisterOrUpdate}>{markerMode === 'register' ? '등록' : '수정'}</button>
            <button className='closebutton' onClick={handleCancel}>취소</button>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomForm;