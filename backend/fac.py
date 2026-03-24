# Install dependencies as needed:
# pip install kagglehub[pandas-datasets]
import kagglehub
from kagglehub import KaggleDatasetAdapter

# Set the path to the file you'd like to load
file_path = ""

# Load the latest version
df = kagglehub.load_dataset(
  KaggleDatasetAdapter.PANDAS,
  "tapakah68/selfies-and-video-dataset-4-000-people",
  file_path,
  # Provide any additional arguments like 
  # sql_query or pandas_kwargs. See the 
  # documenation for more information:
  # https://github.com/Kaggle/kagglehub/blob/main/README.md#kaggledatasetadapterpandas
)

print("First 5 records:", df.head())
import cv2
import numpy as np
from deepface import DeepFace
import mediapipe as mp

# ===============================
# CONFIGURATION
# ===============================
REFERENCE_IMAGE = reference_image
VIDEO_PATH = video
FRAME_INTERVAL = 30          # process 1 frame per second
MATCH_THRESHOLD = 0.7        # 70% match required
EYE_THRESHOLD = 0.01
HEAD_MOVEMENT_THRESHOLD = 0.02


# ===============================
# FACE VERIFICATION FUNCTION
# ===============================
def face_verification(reference_image, video_path):
    cap = cv2.VideoCapture(video_path)

    matched = 0
    total = 0
    frame_count = 0

    print("🔍 Performing face verification...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % FRAME_INTERVAL == 0:
            cv2.imwrite("temp.jpg", frame)

            try:
                result = DeepFace.verify(
                    img1_path=reference_image,
                    img2_path="temp.jpg",
                    enforce_detection=False
                )

                total += 1
                if result["verified"]:
                    matched += 1

            except:
                pass

        frame_count += 1

    cap.release()

    if total == 0:
        return 0

    return matched / total


# ===============================
# LIVENESS DETECTION FUNCTION
# ===============================
def liveness_detection(video_path):
    mp_face = mp.solutions.face_mesh
    face_mesh = mp_face.FaceMesh(refine_landmarks=True)

    cap = cv2.VideoCapture(video_path)

    blink_count = 0
    prev_eye_open = True
    nose_positions = []

    print("👁 Performing liveness detection...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = face_mesh.process(rgb)

        if result.multi_face_landmarks:
            landmarks = result.multi_face_landmarks[0].landmark

            # Eye blink detection (left eye)
            top = landmarks[159].y
            bottom = landmarks[145].y
            eye_open = (bottom - top) > EYE_THRESHOLD

            if prev_eye_open and not eye_open:
                blink_count += 1

            prev_eye_open = eye_open

            # Head movement (nose X position)
            nose_positions.append(landmarks[1].x)

    cap.release()

    head_movement = False
    if len(nose_positions) > 10:
        if max(nose_positions) - min(nose_positions) > HEAD_MOVEMENT_THRESHOLD:
            head_movement = True

    return blink_count > 0 or head_movement


# ===============================
# MAIN EXECUTION
# ===============================
face_match_ratio = face_verification(REFERENCE_IMAGE, VIDEO_PATH)
liveness_passed = liveness_detection(VIDEO_PATH)

print("\n==============================")
print("📊 RESULTS")
print("==============================")
print(f"Face Match Ratio: {face_match_ratio:.2f}")
print(f"Liveness Passed: {liveness_passed}")

print("\n🔐 FINAL DECISION")
if face_match_ratio >= MATCH_THRESHOLD and liveness_passed:
    print("✅ VERIFIED: Same person and live")
else:
    print("❌ FAILED: Identity or liveness not confirmed")
