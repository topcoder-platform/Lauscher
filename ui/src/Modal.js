import React from 'react';
import _ from 'lodash';
import './Modal.css';

export default function Modal({message, onClose}){
  return (
    <div className="modal-wrap">
      <div className="modal-back"></div>
      <div className="modal-bd">
        <div className="modal-close" onClick={onClose}>&times;</div>
        <div className="modal-bd-content">
          {
            _.isObject(message.payload) ?
            (
              <code>
                <pre>
                  {
                    JSON.stringify(message.payload, null, 2)
                  }
                </pre>
              </code>
            ) :
            (<div className="text-content">{message.payload}</div>)
          }
        </div>
      </div>
    </div>
  )
}