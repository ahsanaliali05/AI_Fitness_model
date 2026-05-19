REFERENCE_SQUAT = {
    "name": "Ideal Squat",
    "keypoints": [
        (0.5,0.1), (0.45,0.12), (0.55,0.12), (0.43,0.15), (0.57,0.15),
        (0.4,0.3), (0.6,0.3), (0.35,0.45), (0.65,0.45), (0.3,0.65),
        (0.7,0.65), (0.45,0.55), (0.55,0.55), (0.4,0.7), (0.6,0.7),
        (0.38,0.85), (0.62,0.85), (0.45,0.3), (0.55,0.3), (0.45,0.92),
        (0.55,0.92), (0.5,0.2), (0.5,0.2), (0.4,0.3), (0.6,0.3),
        (0.4,0.7), (0.6,0.7), (0.38,0.85), (0.62,0.85), (0.38,0.85),
        (0.62,0.85), (0.45,0.92), (0.55,0.92)
    ]
}

def compute_pose_similarity(user_kps, ref_kps, indices=None):
    if indices is None:
        indices = [5,6,11,12,13,14,15,16]
    errors = []
    for i in indices:
        if i < len(user_kps) and i < len(ref_kps):
            ux, uy = user_kps[i]
            rx, ry = ref_kps[i]
            dist = ((ux - rx)**2 + (uy - ry)**2) ** 0.5
            errors.append(dist)
    if not errors:
        return 0, {}
    avg_error = sum(errors) / len(errors)
    similarity = max(0, (1 - avg_error) * 100)
    return similarity, {"avg_error": avg_error}