import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '../api';

// MediaPipe 33 keypoint connections (full body)
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],
  [11,12],[11,23],[12,24],[23,24],
  [11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
  [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
  [23,25],[25,27],[27,29],[27,31],
  [24,26],[26,28],[28,30],[28,32],
];

// Helper: compute angle between three points (a-b-c) in degrees
function computeAngle(a, b, c) {
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const mag = Math.hypot(...ba) * Math.hypot(...bc);
  const cos = dot / mag;
  return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
}

// Helper: map natural dimensions to displayed canvas (object-fit: cover)
function getCoverTransform(element, container) {
  let naturalW, naturalH;
  if (element.tagName === 'VIDEO') {
    naturalW = element.videoWidth;
    naturalH = element.videoHeight;
  } else if (element.tagName === 'IMG') {
    naturalW = element.naturalWidth;
    naturalH = element.naturalHeight;
  } else {
    return null;
  }
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  if (naturalW === 0 || naturalH === 0) return null;

  const naturalAspect = naturalW / naturalH;
  const containerAspect = containerW / containerH;
  let scale, offsetX, offsetY;

  if (naturalAspect > containerAspect) {
    scale = containerH / naturalH;
    const scaledW = naturalW * scale;
    offsetX = (containerW - scaledW) / 2;
    offsetY = 0;
  } else {
    scale = containerW / naturalW;
    const scaledH = naturalH * scale;
    offsetX = 0;
    offsetY = (containerH - scaledH) / 2;
  }
  return { scale, offsetX, offsetY };
}

export default function CameraView({ exercise, token }) {
  const [cameraMode, setCameraMode] = useState('laptop');
  const [mobileIP, setMobileIP] = useState('http://192.168.1.2:8080/video');
  const mobileImgRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const masterCanvasRef = useRef(null);
  const [feedback, setFeedback] = useState('');
  const [similarity, setSimilarity] = useState(null);
  // Session tracking for saving workout
  const [sessionReps, setSessionReps] = useState(0);
  const [sessionAccuracySum, setSessionAccuracySum] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [isDetecting, setIsDetecting] = useState(true);
  const [keypoints, setKeypoints] = useState([]);
  const [squatFrame, setSquatFrame] = useState(0);
  const [pushupFrame, setPushupFrame] = useState(0);
  const [lungeFrame, setLungeFrame] = useState(0);
  const [curlFrame, setCurlFrame] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [lastState, setLastState] = useState(null); // 'down' or 'up'
  const [displayAccuracy, setDisplayAccuracy] = useState(0);

  // Animate masters
  useEffect(() => {
    let interval;
    if (exercise === 'squat') {
      interval = setInterval(() => setSquatFrame(prev => (prev + 1) % 100), 40);
    } else if (exercise === 'pushup') {
      interval = setInterval(() => setPushupFrame(prev => (prev + 1) % 100), 40);
    } else if (exercise === 'lunge') {
      interval = setInterval(() => setLungeFrame(prev => (prev + 1) % 100), 40);
    } else if (exercise === 'curl') {
      interval = setInterval(() => setCurlFrame(prev => (prev + 1) % 100), 40);
    }
    return () => clearInterval(interval);
  }, [exercise]);

  // Draw Squat Master (cyan stick figure)
  const drawSquatMaster = useCallback(() => {
    const canvas = masterCanvasRef.current;
    if (!canvas || exercise !== 'squat') return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#00ffff';
    const progress = Math.sin((squatFrame / 100) * Math.PI * 2);
    const hipY = 110 + progress * 35;
    const kneeY = 180 + progress * 10;
    const shoulderY = 60 + progress * 20;
    // head
    ctx.beginPath();
    ctx.arc(100, shoulderY - 25, 12, 0, 2 * Math.PI);
    ctx.fill();
    // torso
    ctx.beginPath();
    ctx.moveTo(100, shoulderY);
    ctx.lineTo(100, hipY);
    ctx.stroke();
    // arms
    ctx.beginPath();
    ctx.moveTo(100, shoulderY + 10);
    ctx.lineTo(70, shoulderY + 40);
    ctx.moveTo(100, shoulderY + 10);
    ctx.lineTo(130, shoulderY + 40);
    ctx.stroke();
    // legs
    ctx.beginPath();
    ctx.moveTo(100, hipY);
    ctx.lineTo(80, kneeY);
    ctx.lineTo(70, 250);
    ctx.moveTo(100, hipY);
    ctx.lineTo(120, kneeY);
    ctx.lineTo(130, 250);
    ctx.stroke();
    // joints
    [[100, shoulderY], [100, hipY], [80, kneeY], [120, kneeY], [70, 250], [130, 250]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [squatFrame, exercise]);

  // Draw Push‑up Master (cyan stick figure moving up/down)
  const drawPushupMaster = useCallback(() => {
    const canvas = masterCanvasRef.current;
    if (!canvas || exercise !== 'pushup') return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#00ffff';
    const progress = Math.sin((pushupFrame / 100) * Math.PI * 2);
    const chestY = 60 + progress * 30;
    const hipY = chestY + 40;
    const shoulderX = 100;
    const elbowX = 70;
    const wristX = 50;
    // head
    ctx.beginPath();
    ctx.arc(shoulderX, chestY - 20, 10, 0, 2 * Math.PI);
    ctx.fill();
    // torso
    ctx.beginPath();
    ctx.moveTo(shoulderX, chestY);
    ctx.lineTo(shoulderX, hipY);
    ctx.stroke();
    // arms (bent)
    ctx.beginPath();
    ctx.moveTo(shoulderX, chestY + 5);
    ctx.lineTo(elbowX, chestY + 20);
    ctx.lineTo(wristX, chestY + 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shoulderX, chestY + 5);
    ctx.lineTo(130, chestY + 20);
    ctx.lineTo(150, chestY + 35);
    ctx.stroke();
    // legs (straight down)
    ctx.beginPath();
    ctx.moveTo(shoulderX, hipY);
    ctx.lineTo(85, hipY + 40);
    ctx.lineTo(70, hipY + 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shoulderX, hipY);
    ctx.lineTo(115, hipY + 40);
    ctx.lineTo(130, hipY + 60);
    ctx.stroke();
  }, [pushupFrame, exercise]);

  // Draw Lunge Master (simple lunge animation)
  const drawLungeMaster = useCallback(() => {
    const canvas = masterCanvasRef.current;
    if (!canvas || exercise !== 'lunge') return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#00ffff';
    const progress = Math.sin((lungeFrame / 100) * Math.PI * 2);
    const kneeY = 180 + progress * 15;
    // head
    ctx.beginPath();
    ctx.arc(100, 60, 12, 0, 2 * Math.PI);
    ctx.fill();
    // torso
    ctx.beginPath();
    ctx.moveTo(100, 70);
    ctx.lineTo(100, 140);
    ctx.stroke();
    // arms
    ctx.beginPath();
    ctx.moveTo(100, 80);
    ctx.lineTo(70, 100);
    ctx.moveTo(100, 80);
    ctx.lineTo(130, 100);
    ctx.stroke();
    // legs – forward leg bent, back leg straight
    ctx.beginPath();
    ctx.moveTo(100, 140);
    ctx.lineTo(80, kneeY);
    ctx.lineTo(70, 240);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(100, 140);
    ctx.lineTo(120, 180);
    ctx.lineTo(130, 250);
    ctx.stroke();
  }, [lungeFrame, exercise]);

  // Draw Bicep Curl Master (arm curling animation)
  const drawCurlMaster = useCallback(() => {
    const canvas = masterCanvasRef.current;
    if (!canvas || exercise !== 'curl') return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#00ffff';
    const progress = Math.sin((curlFrame / 100) * Math.PI * 2);
    const elbowY = 120 + progress * 15;
    // head
    ctx.beginPath();
    ctx.arc(100, 50, 12, 0, 2 * Math.PI);
    ctx.fill();
    // torso
    ctx.beginPath();
    ctx.moveTo(100, 60);
    ctx.lineTo(100, 110);
    ctx.stroke();
    // left arm (curling)
    ctx.beginPath();
    ctx.moveTo(100, 70);
    ctx.lineTo(80, 90);
    ctx.lineTo(60, elbowY);
    ctx.stroke();
    // right arm (curling)
    ctx.beginPath();
    ctx.moveTo(100, 70);
    ctx.lineTo(120, 90);
    ctx.lineTo(140, elbowY);
    ctx.stroke();
    // legs
    ctx.beginPath();
    ctx.moveTo(100, 110);
    ctx.lineTo(85, 180);
    ctx.lineTo(75, 250);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(100, 110);
    ctx.lineTo(115, 180);
    ctx.lineTo(125, 250);
    ctx.stroke();
  }, [curlFrame, exercise]);

  useEffect(() => {
    if (exercise === 'squat') drawSquatMaster();
    else if (exercise === 'pushup') drawPushupMaster();
    else if (exercise === 'lunge') drawLungeMaster();
    else if (exercise === 'curl') drawCurlMaster();
  }, [drawSquatMaster, drawPushupMaster, drawLungeMaster, drawCurlMaster, exercise]);

  // Draw user skeleton on canvas (scaled to container)
  const drawSkeleton = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    let mediaElement = null;
    if (cameraMode === 'laptop') {
      mediaElement = webcamRef.current?.video;
    } else {
      mediaElement = mobileImgRef.current;
    }
    if (!canvas || !container || !mediaElement || keypoints.length === 0) return;

    const transform = getCoverTransform(mediaElement, container);
    if (!transform) return;
    const { scale, offsetX, offsetY } = transform;
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ff0000';
    CONNECTIONS.forEach(([i1, i2]) => {
      const p1 = keypoints[i1];
      const p2 = keypoints[i2];
      if (p1 && p2 && p1[0] && p1[1] && p2[0] && p2[1]) {
        ctx.beginPath();
        ctx.moveTo(p1[0] * scale + offsetX, p1[1] * scale + offsetY);
        ctx.lineTo(p2[0] * scale + offsetX, p2[1] * scale + offsetY);
        ctx.stroke();
      }
    });
    keypoints.forEach(kp => {
      if (kp && kp[0] && kp[1]) {
        ctx.beginPath();
        ctx.arc(kp[0] * scale + offsetX, kp[1] * scale + offsetY, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, [keypoints, cameraMode]);

  // Animation loop for skeleton
  useEffect(() => {
    let frame;
    const animate = () => {
      drawSkeleton();
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [drawSkeleton]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => drawSkeleton());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawSkeleton]);

  // Capture frame and send to backend
  const captureAndSend = useCallback(async () => {
    if (cameraMode === 'laptop' && !webcamRef.current) return;
    if (cameraMode === 'mobile' && !mobileImgRef.current) return;

    let imageSrc;
    if (cameraMode === 'laptop') {
      imageSrc = webcamRef.current.getScreenshot();
    } else {
      const img = mobileImgRef.current;
      if (!img.complete || img.naturalWidth === 0) return;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      imageSrc = tempCanvas.toDataURL('image/jpeg');
    }
    if (!imageSrc) return;
    const blob = await fetch(imageSrc).then(res => res.blob());
    const formData = new FormData();
    formData.append('file', blob, 'frame.jpg');
    formData.append('exercise', exercise);

    try {
      // ✅ CHANGED: use api.post instead of fetch to localhost
      const res = await api.post('/api/pose/compare', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setFeedback(data.feedback);
      if (data.similarity !== undefined) setSimilarity(data.similarity);
      if (data.user_keypoints) {
        let mediaElement = null;
        if (cameraMode === 'laptop') {
          mediaElement = webcamRef.current?.video;
        } else {
          mediaElement = mobileImgRef.current;
        }
        if (mediaElement) {
          let w, h;
          if (mediaElement.tagName === 'VIDEO') {
            w = mediaElement.videoWidth;
            h = mediaElement.videoHeight;
          } else {
            w = mediaElement.naturalWidth;
            h = mediaElement.naturalHeight;
          }
          if (w && h) {
            const absKeypoints = data.user_keypoints.map(([x, y]) => [x * w, y * h]);
            setKeypoints(absKeypoints);
            // --- Angle calculation and rep counting ---
            let currentAngle = null;
            let accuracy = null;
            if (exercise === 'squat') {
              const hip = absKeypoints[23];
              const knee = absKeypoints[25];
              const ankle = absKeypoints[27];
              if (hip && knee && ankle) {
                currentAngle = computeAngle(hip, knee, ankle);
                accuracy = data.similarity; // use backend similarity for squat
              }
            } else if (exercise === 'lunge') {
              // Use left leg (hip23, knee25, ankle27) – user should face sideways
              const hip = absKeypoints[23];
              const knee = absKeypoints[25];
              const ankle = absKeypoints[27];
              if (hip && knee && ankle) {
                currentAngle = computeAngle(hip, knee, ankle);
                accuracy = Math.max(0, 100 - (Math.abs(currentAngle - 90) / 90) * 100);
              }
            } else if (exercise === 'pushup') {
              const shoulder = absKeypoints[11];
              const elbow = absKeypoints[13];
              const wrist = absKeypoints[15];
              if (shoulder && elbow && wrist) {
                currentAngle = computeAngle(shoulder, elbow, wrist);
                accuracy = Math.max(0, 100 - (Math.abs(currentAngle - 90) / 90) * 100);
              }
            } else if (exercise === 'curl') {
              // Use right arm (shoulder12, elbow14, wrist16)
              const shoulder = absKeypoints[12];
              const elbow = absKeypoints[14];
              const wrist = absKeypoints[16];
              if (shoulder && elbow && wrist) {
                currentAngle = computeAngle(shoulder, elbow, wrist);
                accuracy = Math.max(0, 100 - (Math.abs(currentAngle - 90) / 90) * 100);
              }
            }
            if (currentAngle !== null) {
              setDisplayAccuracy(accuracy !== null ? Math.round(accuracy) : 0);
              // Rep counting thresholds
              let downThresh, upThresh;
              if (exercise === 'squat') { downThresh = 90; upThresh = 110; }
              else if (exercise === 'pushup') { downThresh = 90; upThresh = 140; }
              else { downThresh = 90; upThresh = 110; } // lunge and curl
              if (currentAngle < downThresh && lastState !== 'down') {
                setLastState('down');
              } else if (currentAngle > upThresh && lastState === 'down') {
                setLastState('up');
                setRepCount(prev => prev + 1);
                // Session tracking
                setSessionReps(prev => prev + 1);
                setSessionAccuracySum(prev => prev + (accuracy !== null ? accuracy : 0));
                setSessionCount(prev => prev + 1);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setFeedback('Error: ' + err.message);
    }
  }, [exercise, token, cameraMode, lastState]);

  // Periodic capture (every 500ms)
  useEffect(() => {
    if (!isDetecting) return;
    const interval = setInterval(captureAndSend, 500);
    return () => clearInterval(interval);
  }, [isDetecting, captureAndSend]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionReps > 0) {
        const avgAccuracy = sessionCount > 0 ? sessionAccuracySum / sessionCount : 0;
        navigator.sendBeacon('/api/workout/save', JSON.stringify({
          exercise: exercise,
          rep_count: sessionReps,
          avg_accuracy: avgAccuracy
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionReps, sessionAccuracySum, sessionCount, exercise]);

  // Save workout session when detection is paused
  useEffect(() => {
    if (!isDetecting && (sessionReps > 0 || sessionCount > 0)) {
      const avgAccuracy = sessionCount > 0 ? sessionAccuracySum / sessionCount : 0;
      api.post('/api/workout/save', {
        exercise: exercise,
        rep_count: sessionReps,
        avg_accuracy: avgAccuracy
      }).catch(err => console.error('Failed to save workout', err));
      setSessionReps(0);
      setSessionAccuracySum(0);
      setSessionCount(0);
    }
  }, [isDetecting, sessionReps, sessionAccuracySum, sessionCount, exercise]);

  // --- MANUAL SAVE WORKOUT BUTTON FUNCTION ---
  const saveWorkout = async () => {
    if (repCount === 0) {
      alert('No reps to save. Perform some reps first.');
      return;
    }
    const avgAccuracy = sessionCount > 0 ? sessionAccuracySum / sessionCount : 0;
    try {
      await api.post('/api/workout/save', {
        exercise: exercise,
        rep_count: repCount,
        avg_accuracy: avgAccuracy
      });
      alert(`Workout saved: ${repCount} reps, ${avgAccuracy.toFixed(1)}% accuracy`);
      // Reset session and rep counters
      setRepCount(0);
      setSessionReps(0);
      setSessionAccuracySum(0);
      setSessionCount(0);
      setLastState(null);
    } catch (err) {
      console.error('Failed to save workout', err);
      alert('Error saving workout. Check console.');
    }
  };
  const resetReps = () => {
  setRepCount(0);
  setSessionReps(0);
  setSessionAccuracySum(0);
  setSessionCount(0);
  setLastState(null);
  alert('Reps reset. Start your next set!');
};

  // Determine master position and name
  const masterPosition = (exercise === 'squat' || exercise === 'lunge') ? 'left' : 'right';
  const masterName = exercise === 'squat' ? 'Squat Master' : exercise === 'lunge' ? 'Lunge Master' : exercise === 'pushup' ? 'Push‑up Master' : 'Curl Master';

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      {/* Master Coach – positioned left for squat/lunge, right for pushup/curl */}
      <div style={{
        position: 'absolute',
        top: 20,
        [masterPosition]: 20,
        width: 160,
        height: 160,
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        padding: 5,
        zIndex: 10
      }}>
        <canvas ref={masterCanvasRef} width={160} height={160} style={{ width: '100%', height: '100%' }} />
        <div style={{ color: 'white', fontSize: '12px', textAlign: 'center' }}>
          {masterName}
        </div>
      </div>

      {/* User Camera + Skeleton Overlay */}
      <div ref={containerRef} style={{ position: 'relative', width: '100%', paddingBottom: '75%' }}>
        {cameraMode === 'laptop' ? (
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            videoConstraints={{ facingMode: 'user' }}
          />
        ) : (
          <img
            ref={mobileImgRef}
            src={mobileIP}
            alt="Mobile Camera"
            crossOrigin="anonymous"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onLoad={() => drawSkeleton()}
          />
        )}
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      {/* Camera Source Controls */}
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <button onClick={() => setCameraMode('laptop')} style={{ background: cameraMode === 'laptop' ? '#00aaee' : '#333', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          💻 Laptop Camera
        </button>
        <button onClick={() => setCameraMode('mobile')} style={{ background: cameraMode === 'mobile' ? '#00aaee' : '#333', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          📱 Mobile IP Webcam
        </button>
      </div>

      {cameraMode === 'mobile' && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <input type="text" value={mobileIP} onChange={(e) => setMobileIP(e.target.value)} placeholder="http://192.168.1.2:8080/video" style={{ width: '320px', padding: '10px', borderRadius: '8px', border: '1px solid #555' }} />
          <div style={{ color: '#ccc', marginTop: '8px', fontSize: '14px' }}>Open IP Webcam app on phone and paste video URL here</div>
        </div>
      )}

      {/* Action Buttons & Feedback */}
     <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
  <button onClick={() => setIsDetecting(!isDetecting)}>{isDetecting ? '⏸ Pause' : '▶ Start'}</button>
  <button onClick={saveWorkout} style={{ background: '#00aaee', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
    💾 Save Workout
  </button>
  <button onClick={resetReps} style={{ background: '#ffaa00', color: '#000', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
    🔄 Reset Reps
  </button>
  <div>Accuracy: <strong>{displayAccuracy}%</strong></div>
  <div>Reps: <strong>{repCount}</strong></div>
</div>

      <p style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', marginTop: '15px', color: 'white', background: '#222', padding: '10px', borderRadius: '10px' }}>
        {feedback}
      </p>
    </div>
  );
}
