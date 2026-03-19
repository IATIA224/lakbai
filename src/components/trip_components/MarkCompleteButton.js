import React from "react";
import ReactDOM from "react-dom";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import "./ConfirmationModal.css";

function ConfirmationModal({ title, message, onConfirm, onCancel, confirmText = "OK", cancelText = "Cancel", isDanger = false }) {
  return ReactDOM.createPortal(
    <div className="confirmation-overlay">
      <div className="confirmation-modal">
        <div className="confirmation-header">
          <h2 className="confirmation-title">{title}</h2>
        </div>
        
        <div className="confirmation-body">
          <p className="confirmation-message">{message}</p>
        </div>
        
        <div className="confirmation-footer">
          <button 
            className="confirmation-btn cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirmation-btn confirm ${isDanger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export async function markAllCompleted(items, user, sharedItineraries = null) {
  if (!user || !items.length) return;

  return new Promise((resolve) => {
    const modalRoot = document.createElement("div");
    document.body.appendChild(modalRoot);

    const handleConfirm = async () => {
      try {
        const batch = writeBatch(db);
        
        if (!sharedItineraries) {
          items.forEach(item => {
            const ref = doc(db, "itinerary", user.uid, "items", item.id);
            batch.update(ref, { status: "Completed" });
          });
        } else {
          sharedItineraries.forEach(shared => {
            shared.items.forEach(item => {
              const ref = doc(db, "sharedItineraries", shared.id, "items", item.id);
              batch.update(ref, { status: "Completed" });
            });
          });
        }
        
        await batch.commit();
        ReactDOM.unmountComponentAtNode(modalRoot);
        modalRoot.remove();
        showSuccessModal(`✅ Marked ${items.length} destination(s) as completed!`);
        resolve(true);
      } catch (error) {
        console.error("Error marking destinations as completed:", error);
        ReactDOM.unmountComponentAtNode(modalRoot);
        modalRoot.remove();
        showErrorModal("Failed to mark destinations as completed.");
        resolve(false);
      }
    };

    const handleCancel = () => {
      ReactDOM.unmountComponentAtNode(modalRoot);
      modalRoot.remove();
      resolve(false);
    };

    ReactDOM.render(
      <ConfirmationModal
        title="Mark as Completed"
        message={`Mark all ${items.length} destination(s) as completed?`}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmText="Mark Complete"
        cancelText="Cancel"
      />,
      modalRoot
    );
  });
}

function showSuccessModal(message) {
  const div = document.createElement("div");
  document.body.appendChild(div);
  
  const handleClose = () => {
    ReactDOM.unmountComponentAtNode(div);
    div.remove();
  };

  ReactDOM.render(
    <ConfirmationModal
      title="✅ Success"
      message={message}
      onConfirm={handleClose}
      onCancel={handleClose}
      confirmText="OK"
    />,
    div
  );

  setTimeout(handleClose, 3000);
}

function showErrorModal(message) {
  const div = document.createElement("div");
  document.body.appendChild(div);
  
  const handleClose = () => {
    ReactDOM.unmountComponentAtNode(div);
    div.remove();
  };

  ReactDOM.render(
    <ConfirmationModal
      title="❌ Error"
      message={message}
      onConfirm={handleClose}
      onCancel={handleClose}
      confirmText="OK"
      isDanger={true}
    />,
    div
  );
}