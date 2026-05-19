from fastapi import APIRouter, File, UploadFile, Depends
from ..pose_engine import MoveNetEngine
from ..auth import get_current_user
from ..reference_pose import REFERENCE_SQUAT, compute_pose_similarity

router = APIRouter(prefix="/api/pose", tags=["pose"])
pose_engine = MoveNetEngine()

@router.post("/analyze")
async def analyze_pose(
    file: UploadFile = File(...),
    exercise: str = "squat",
    user = Depends(get_current_user)  # optional
):
    image_bytes = await file.read()
    coords = pose_engine.detect_keypoints(image_bytes)
    if coords is None:
        return {"feedback": "❌ No person detected", "keypoints": []}
    angles = pose_engine.get_angles_for_exercise(coords, exercise)
    feedback = pose_engine.get_feedback(angles, exercise)
    return {"angles": angles, "feedback": feedback, "keypoints": list(coords.values())}

@router.post("/compare")
async def compare_pose(
    file: UploadFile = File(...),
    user = Depends(get_current_user)
):
    image_bytes = await file.read()
    user_norm = pose_engine.get_normalized_keypoints(image_bytes)
    if user_norm is None:
        return {"similarity": 0, "feedback": "No person detected"}
    similarity, _ = compute_pose_similarity(user_norm, REFERENCE_SQUAT["keypoints"])
    feedback = f"Match: {similarity:.1f}%" + (" – Perfect!" if similarity > 85 else " – Keep adjusting.")
    return {"similarity": round(similarity,1), "feedback": feedback, "user_keypoints": user_norm}