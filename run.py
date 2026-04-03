import sys
sys.path.insert(0, "/Users/dixitabajracharya/kaam-ly/Kaam-ly")

import joblib
from worker.model.LinUCB import LinUCB

MODEL_PATH = "/Users/dixitabajracharya/kaam-ly/Kaam-ly/worker/model/linucb_model.joblib"

class FixUnpickler(joblib.numpy_pickle.NumpyUnpickler):
    def find_class(self, module, name):
        if name == "LinUCB":
            return LinUCB
        return super().find_class(module, name)

with open(MODEL_PATH, "rb") as f:
    unpickler = FixUnpickler(MODEL_PATH, f)  # ✅ FIXED
    model_data = unpickler.load()

joblib.dump(model_data, MODEL_PATH)

print("✅ Done — model re-saved with correct class path")