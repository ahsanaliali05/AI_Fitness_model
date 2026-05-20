import mediapipe as mp
import numpy as np
from PIL import Image
import io

class MoveNetEngine:
    def __init__(self):
        self.available = False
        try:
            # Try to access the solutions module (may fail if MediaPipe is broken)
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.available = True
            print("MediaPipe pose detection initialized successfully.")
        except AttributeError as e:
            print(f"MediaPipe not fully available: {e}. Pose estimation disabled.")
            self.pose = None

    def detect_keypoints(self, image_bytes):
        if not self.available:
            return None
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            w, h = img.size
            img_np = np.array(img)
            results = self.pose.process(img_np)
            if not results.pose_landmarks:
                return None
            coords = {}
            for idx, lm in enumerate(results.pose_landmarks.landmark):
                x, y = int(lm.x * w), int(lm.y * h)
                coords[idx] = (x, y)
            return coords
        except Exception as e:
            print(f"Error in detect_keypoints: {e}")
            return None

    def get_normalized_keypoints(self, image_bytes):
        if not self.available:
            return None
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img_np = np.array(img)
            results = self.pose.process(img_np)
            if not results.pose_landmarks:
                return None
            normalized = []
            for lm in results.pose_landmarks.landmark:
                normalized.append((lm.x, lm.y))
            return normalized
        except Exception as e:
            print(f"Error in get_normalized_keypoints: {e}")
            return None
