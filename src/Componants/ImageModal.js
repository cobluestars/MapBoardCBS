import React, { useState } from 'react';

// 이미지 모달 컴포넌트 생성
function ImageModal({ isOpen, srcs, currentImageIndex, onClose }) {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(currentImageIndex);

    // 모달이 열려 있지 않으면 null 반환
    if (!isOpen || !srcs || srcs.length === 0) return null;

    // 이전 슬라이드로 이동
    const goToPrevSlide = (e) => {
        e.stopPropagation();
        let newIndex = currentSlideIndex - 1;
        if (newIndex < 0) newIndex = srcs.length - 1;   // 끝으로 이동
        setCurrentSlideIndex(newIndex);
    };

    // 다음 슬라이드로 이동
    const goToNextSlide = (e) => {
        e.stopPropagation();
        let newIndex = currentSlideIndex + 1;
        if (newIndex >= srcs.length) newIndex = 0;  // 시작으로 이동
        setCurrentSlideIndex(newIndex);
    };

    // 배경 클릭 핸들러
    const handleBackgroundClick = () => {
        onClose();
    };

    // 이미지 클릭 핸들러
    const handleImageClick = (e) => {
        e.stopPropagation(); // 배경 클릭 이벤트가 이미지 연속 클릭시 중복되어 발생하는 것을 방지
    };

    return (
        <div onClick={handleBackgroundClick}
             style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
        }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                    onClick={handleImageClick}
                    src={srcs[currentSlideIndex]} 
                    alt="Full Size" 
                    style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                />
                <div style={{ display: 'flex', marginTop: '10px', gap: '10px' }}>
                    <button onClick={(e) => goToPrevSlide(e)}>Prev</button>
                    <button onClick={(e) => goToNextSlide(e)}>Next</button>
                </div>
                <span
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        cursor: 'pointer'
                    }}
                    onClick={onClose}>
                    X
                </span>
            </div>
        </div>
    );
}

export default ImageModal;
