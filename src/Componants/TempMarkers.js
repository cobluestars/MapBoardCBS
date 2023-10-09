import { doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const TEMP_MARKER_DOC_ID = 'TEMP_MARKER';  // 임시 마커를 위한 문서 ID

export const saveTempMarkerPosition = async (position) => {
    const tempMarkerRef = doc(db, 'markers', TEMP_MARKER_DOC_ID);
    
    const tempMarkerSnapshot = await getDoc(tempMarkerRef);

    if (tempMarkerSnapshot.exists()) {
        // 문서가 이미 존재하면 업데이트
        await updateDoc(tempMarkerRef, { position });
    } else {
        // 문서가 없으면 새로 생성
        await setDoc(tempMarkerRef, { position });
    }
};

export const getTempMarkerPosition = async () => {
    const tempMarkerRef = doc(db, 'markers', TEMP_MARKER_DOC_ID);
    const tempMarkerSnapshot = await getDoc(tempMarkerRef);
    return tempMarkerSnapshot.data()?.position || null;
};

export const deleteTempMarkerPosition = async () => {
    const tempMarkerRef = doc(db, 'markers', TEMP_MARKER_DOC_ID);
    await deleteDoc(tempMarkerRef);
};