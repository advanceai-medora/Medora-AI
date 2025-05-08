/**
 * settings.js - Provider settings component for Medora
 */

// Create a settings modal when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Create the settings modal
    createSettingsModal();
});

// Create the settings modal in the DOM
function createSettingsModal() {
    // Check if modal already exists
    if (document.getElementById('settings-modal')) {
        return; // Modal already exists
    }
    
    // Create the modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'settings-modal';
    modalContainer.className = 'modal-container';
    modalContainer.style.display = 'none';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalContainer.style.zIndex = '2000';
    modalContainer.style.opacity = '0';
    modalContainer.style.transition = 'opacity 0.3s ease';
    
    // Create the modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.position = 'absolute';
    modalContent.style.top = '50%';
    modalContent.style.left = '50%';
    modalContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.padding = '0';
    modalContent.style.borderRadius = '8px';
    modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '800px';
    modalContent.style.maxHeight = '85vh';
    modalContent.style.overflow = 'hidden';
    modalContent.style.transition = 'transform 0.3s ease';
    
    // Create settings content
    modalContent.innerHTML = `
        <div style="display: flex; height: 100%;">
            <!-- Settings sidebar -->
            <div style="width: 250px; background-color: #f0f7ff; border-right: 1px solid #e5e7eb; overflow-y: auto;">
                <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h2 style="margin: 0; font-size: 20px; color: #1a3c87; font-weight: 600;">Settings</h2>
                </div>
                <ul id="settings-tabs" style="list-style: none; padding: 0; margin: 0;">
                    <li class="settings-tab active-tab" data-tab="general" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #1a3c87; font-weight: 500; background-color: rgba(58, 91, 169, 0.05);">
                        <span style="margin-right: 10px;">⚙️</span> General
                    </li>
                    <li class="settings-tab" data-tab="clinical" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">🩺</span> Clinical Preferences
                    </li>
                    <li class="settings-tab" data-tab="notes" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">📝</span> Note Templates
                    </li>
                    <li class="settings-tab" data-tab="notifications" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">🔔</span> Notifications
                    </li>
                    <li class="settings-tab" data-tab="security" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">🔒</span> Security & Privacy
                    </li>
                    <li class="settings-tab" data-tab="integrations" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">🔌</span> Integrations
                    </li>
                    <li class="settings-tab" data-tab="billing" style="padding: 15px 20px; cursor: pointer; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                        <span style="margin-right: 10px;">💳</span> Billing & Plan
                    </li>
                </ul>
                <div style="padding: 20px;">
                    <button id="close-settings-btn" style="width: 100%; padding: 10px; background-color: #f0f2f5; border: none; border-radius: 6px; color: #4b5563; font-size: 14px; cursor: pointer;">Close Settings</button>
                </div>
            </div>
            
            <!-- Settings content -->
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <!-- General Settings Tab -->
                <div id="general-tab" class="settings-content active-content">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">General Settings</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Interface Settings</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Default Dashboard View</label>
                                <select id="default-dashboard" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="patients">Patients List</option>
                                    <option value="activities">Recent Activities</option>
                                    <option value="calendar">Calendar View</option>
                                </select>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                <input type="checkbox" id="auto-save" style="margin-right: 10px;">
                                <label for="auto-save" style="font-size: 14px; color: #4b5563;">Auto-save notes every 30 seconds</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                <input type="checkbox" id="confirm-logout" style="margin-right: 10px;" checked>
                                <label for="confirm-logout" style="font-size: 14px; color: #4b5563;">Confirm before logging out</label>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Session Timeout Duration</label>
                                <select id="session-timeout" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="15">15 minutes</option>
                                    <option value="30" selected>30 minutes</option>
                                    <option value="45">45 minutes</option>
                                    <option value="60">60 minutes</option>
                                </select>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Duration before your session changes from Active to Away status.</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Language & Region</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Language</label>
                                <select id="language-setting" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="en">English (US)</option>
                                    <option value="en-gb">English (UK)</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                </select>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Time Format</label>
                                <select id="time-format" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="12h">12-hour (1:30 PM)</option>
                                    <option value="24h">24-hour (13:30)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Date Format</label>
                                <select id="date-format" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="mdy">MM/DD/YYYY</option>
                                    <option value="dmy">DD/MM/YYYY</option>
                                    <option value="ymd">YYYY/MM/DD</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Clinical Preferences Tab -->
                <div id="clinical-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Clinical Preferences</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">SOAP Note Preferences</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Default Format</label>
                                <select id="default-note-format" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="narrative">Narrative (Paragraph)</option>
                                    <option value="bullet">Bullet Points</option>
                                </select>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Verbosity Level</label>
                                <select id="verbosity-level" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="concise">Concise</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                <input type="checkbox" id="include-negatives" style="margin-right: 10px;" checked>
                                <label for="include-negatives" style="font-size: 14px; color: #4b5563;">Include negative findings</label>
                            </div>
                            
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" id="auto-code" style="margin-right: 10px;" checked>
                                <label for="auto-code" style="font-size: 14px; color: #4b5563;">Auto-generate billing codes</label>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Specialty-Specific Settings</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Specialty</label>
                                <select id="specialty-setting" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="allergist">Allergist</option>
                                    <option value="cardiologist">Cardiologist</option>
                                    <option value="dermatologist">Dermatologist</option>
                                    <option value="emergency">Emergency Medicine</option>
                                    <option value="family">Family Medicine</option>
                                    <option value="internal">Internal Medicine</option>
                                    <option value="other">Other Specialty</option>
                                </select>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Common Conditions (Select multiple)</label>
                                <select id="common-conditions" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; height: 100px;" multiple>
                                    <option value="asthma">Asthma</option>
                                    <option value="rhinitis">Allergic Rhinitis</option>
                                    <option value="sinusitis">Sinusitis</option>
                                    <option value="eczema">Eczema</option>
                                    <option value="food_allergy">Food Allergy</option>
                                    <option value="drug_allergy">Drug Allergy</option>
                                    <option value="anaphylaxis">Anaphylaxis</option>
                                    <option value="immunodeficiency">Immunodeficiency</option>
                                </select>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Hold Ctrl/Cmd to select multiple conditions</div>
                            </div>
                            
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" id="customize-insights" style="margin-right: 10px;" checked>
                                <label for="customize-insights" style="font-size: 14px; color: #4b5563;">Customize AI insights for specialty</label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Note Templates Tab -->
                <div id="notes-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Note Templates</h3>
                    
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
                        <button id="add-template-btn" style="padding: 8px 16px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; display: flex; align-items: center;">
                            <span style="margin-right: 5px;">+</span> New Template
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Your Templates</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Initial Allergy Consultation</div>
                                    <div style="font-size: 12px; color: #6b7280;">Last edited: May 1, 2025</div>
                                </div>
                                <div>
                                    <button class="template-edit-btn" style="padding: 4px 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 5px;">Edit</button>
                                    <button class="template-delete-btn" style="padding: 4px 8px; background-color: #fee2e2; color: #dc2626; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Delete</button>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Follow-up Visit</div>
                                    <div style="font-size: 12px; color: #6b7280;">Last edited: May 3, 2025</div>
                                </div>
                                <div>
                                    <button class="template-edit-btn" style="padding: 4px 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 5px;">Edit</button>
                                    <button class="template-delete-btn" style="padding: 4px 8px; background-color: #fee2e2; color: #dc2626; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Delete</button>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Annual Review</div>
                                    <div style="font-size: 12px; color: #6b7280;">Last edited: May 7, 2025</div>
                                </div>
                                <div>
                                    <button class="template-edit-btn" style="padding: 4px 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 5px;">Edit</button>
                                    <button class="template-delete-btn" style="padding: 4px 8px; background-color: #fee2e2; color: #dc2626; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Template Settings</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 14px; color: #4b5563; margin-bottom: 8px;">Default Template For New Patients</label>
                                <select id="default-template" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                                    <option value="initial">Initial Allergy Consultation</option>
                                    <option value="followup">Follow-up Visit</option>
                                    <option value="annual">Annual Review</option>
                                    <option value="none">No Template (Blank)</option>
                                </select>
                            </div>
                            
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" id="prompt-template" style="margin-right: 10px;" checked>
                                <label for="prompt-template" style="font-size: 14px; color: #4b5563;">Prompt to select template when starting a visit</label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Notifications Tab -->
                <div id="notifications-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Notification Preferences</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Email Notifications</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="email-daily-summary" style="margin-right: 10px;" checked>
                                <label for="email-daily-summary" style="font-size: 14px; color: #4b5563;">Daily summary of activities</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="email-patient-reminders" style="margin-right: 10px;" checked>
                                <label for="email-patient-reminders" style="font-size: 14px; color: #4b5563;">Patient appointment reminders</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="email-system-updates" style="margin-right: 10px;" checked>
                                <label for="email-system-updates" style="font-size: 14px; color: #4b5563;">System updates and new features</label>
                            </div>
                            
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" id="email-marketing" style="margin-right: 10px;">
                                <label for="email-marketing" style="font-size: 14px; color: #4b5563;">Marketing and promotional emails</label>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">In-App Notifications</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="app-patient-updates" style="margin-right: 10px;" checked>
                                <label for="app-patient-updates" style="font-size: 14px; color: #4b5563;">Patient information updates</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="app-task-reminders" style="margin-right: 10px;" checked>
                                <label for="app-task-reminders" style="font-size: 14px; color: #4b5563;">Task reminders</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="app-system-alerts" style="margin-right: 10px;" checked>
                                <label for="app-system-alerts" style="font-size: 14px; color: #4b5563;">System alerts</label>
                            </div>
                            
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" id="app-session-warnings" style="margin-right: 10px;" checked>
                                <label for="app-session-warnings" style="font-size: 14px; color: #4b5563;">Session timeout warnings</label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Security & Privacy Tab -->
                <div id="security-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Security & Privacy</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Account Security</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 15px;">
                                <button id="change-password-btn" style="width: 100%; padding: 8px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Change Password</button>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label style="font-size: 14px; color: #4b5563;">Two-Factor Authentication</label>
                                    <div style="position: relative; display: inline-block; width: 40px; height: 20px;">
                                        <input type="checkbox" id="two-factor-auth" style="opacity: 0; width: 0; height: 0;">
                                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; transition: .4s; border-radius: 20px;"></span>
                                        <span style="position: absolute; cursor: pointer; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">Secure your account with an additional verification step.</div>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <button id="view-login-history-btn" style="width: 100%; padding: 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">View Login History</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Privacy Settings</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="consent-data-analysis" style="margin-right: 10px;" checked>
                                <label for="consent-data-analysis" style="font-size: 14px; color: #4b5563;">Allow data analysis for service improvement</label>
                            </div>
                            
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="consent-ai-training" style="margin-right: 10px;" checked>
                                <label for="consent-ai-training" style="font-size: 14px; color: #4b5563;">Allow AI training on de-identified data</label>
                            </div>
                            
                            <div style="margin-top: 15px;">
                                <button id="download-data-btn" style="width: 100%; padding: 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Download My Data</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Compliance</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="font-size: 14px; color: #4b5563; margin-bottom: 10px;">
                                Our platform is designed to be HIPAA compliant. All data is encrypted and securely stored.
                            </div>
                            <button id="view-hipaa-compliance-btn" style="width: 100%; padding: 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">View Compliance Documentation</button>
                        </div>
                    </div>
                </div>
                
                <!-- Integrations Tab -->
                <div id="integrations-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Integrations</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">EHR Integrations</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="padding: 10px; background-color: #fff; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <img src="/images/epic-logo.png" alt="Epic" style="width: 30px; height: 30px; margin-right: 10px; background-color: #eee; border-radius: 4px;">
                                    <div>
                                        <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Epic EHR</div>
                                        <div style="font-size: 12px; color: #6b7280;">Not connected</div>
                                    </div>
                                </div>
                                <button class="connect-integration-btn" style="padding: 6px 12px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Connect</button>
                            </div>
                            
                            <div style="padding: 10px; background-color: #fff; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <img src="/images/cerner-logo.png" alt="Cerner" style="width: 30px; height: 30px; margin-right: 10px; background-color: #eee; border-radius: 4px;">
                                    <div>
                                        <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Cerner</div>
                                        <div style="font-size: 12px; color: #6b7280;">Not connected</div>
                                    </div>
                                </div>
                                <button class="connect-integration-btn" style="padding: 6px 12px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Connect</button>
                            </div>
                            
                            <div style="padding: 10px; background-color: #fff; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <img src="/images/athena-logo.png" alt="Athenahealth" style="width: 30px; height: 30px; margin-right: 10px; background-color: #eee; border-radius: 4px;">
                                    <div>
                                        <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Athenahealth</div>
                                        <div style="font-size: 12px; color: #6b7280;">Not connected</div>
                                    </div>
                                </div>
                                <button class="connect-integration-btn" style="padding: 6px 12px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Connect</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Calendar & Scheduling</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="padding: 10px; background-color: #fff; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <img src="/images/google-calendar.png" alt="Google Calendar" style="width: 30px; height: 30px; margin-right: 10px; background-color: #eee; border-radius: 4px;">
                                    <div>
                                        <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Google Calendar</div>
                                        <div style="font-size: 12px; color: #6b7280;">Not connected</div>
                                    </div>
                                </div>
                                <button class="connect-integration-btn" style="padding: 6px 12px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Connect</button>
                            </div>
                            
                            <div style="padding: 10px; background-color: #fff; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <img src="/images/outlook-calendar.png" alt="Outlook Calendar" style="width: 30px; height: 30px; margin-right: 10px; background-color: #eee; border-radius: 4px;">
                                    <div>
                                        <div style="font-size: 14px; font-weight: 500; color: #1a3c87;">Outlook Calendar</div>
                                        <div style="font-size: 12px; color: #6b7280;">Not connected</div>
                                    </div>
                                </div>
                                <button class="connect-integration-btn" style="padding: 6px 12px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Connect</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Billing & Plan Tab -->
                <div id="billing-tab" class="settings-content" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 18px; color: #1a3c87; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Billing & Plan</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Current Plan</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="background-color: #edf4ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #c6d8f9;">
                                <div style="font-size: 16px; font-weight: 600; color: #1a3c87; margin-bottom: 5px;">Professional Plan</div>
                                <div style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">$99/month, billed annually</div>
                                <div style="font-size: 12px; color: #6b7280;">Your plan renews on May 1, 2026</div>
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 14px; font-weight: 500; color: #1a3c87; margin-bottom: 5px;">Plan Features:</div>
                                <ul style="list-style-type: none; padding: 0; margin: 0;">
                                    <li style="display: flex; align-items: flex-start; margin-bottom: 5px; font-size: 14px; color: #4b5563;">
                                        <span style="color: #10b981; margin-right: 5px;">✓</span> Unlimited patient notes
                                    </li>
                                    <li style="display: flex; align-items: flex-start; margin-bottom: 5px; font-size: 14px; color: #4b5563;">
                                        <span style="color: #10b981; margin-right: 5px;">✓</span> Advanced AI recommendations
                                    </li>
                                    <li style="display: flex; align-items: flex-start; margin-bottom: 5px; font-size: 14px; color: #4b5563;">
                                        <span style="color: #10b981; margin-right: 5px;">✓</span> Custom templates
                                    </li>
                                    <li style="display: flex; align-items: flex-start; font-size: 14px; color: #4b5563;">
                                        <span style="color: #10b981; margin-right: 5px;">✓</span> Priority support
                                    </li>
                                </ul>
                            </div>
                            
                            <div>
                                <button id="upgrade-plan-btn" style="width: 100%; padding: 8px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-bottom: 10px;">Upgrade to Enterprise</button>
                                <button id="manage-subscription-btn" style="width: 100%; padding: 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Manage Subscription</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Payment Information</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                                <div style="display: flex; align-items: center;">
                                    <div style="width: 40px; height: 26px; background-color: #e5e7eb; border-radius: 4px; margin-right: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px;">VISA</div>
                                    <div>
                                        <div style="font-size: 14px; color: #1f2937;">•••• •••• •••• 4242</div>
                                        <div style="font-size: 12px; color: #6b7280;">Expires 05/2028</div>
                                    </div>
                                </div>
                                <button id="edit-payment-btn" style="padding: 4px 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Edit</button>
                            </div>
                            
                            <button id="add-payment-method-btn" style="width: 100%; padding: 8px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Add Payment Method</button>
                        </div>
                    </div>
                    
                    <div>
                        <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Billing History</h4>
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; color: #1f2937;">Invoice #MED-2025-001</div>
                                    <div style="font-size: 12px; color: #6b7280;">May 1, 2025 - $1,188.00</div>
                                </div>
                                <a href="#" style="font-size: 12px; color: #3a5ba9; text-decoration: none;">Download</a>
                            </div>
                            
                            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; color: #1f2937;">Invoice #MED-2024-001</div>
                                    <div style="font-size: 12px; color: #6b7280;">May 1, 2024 - $1,188.00</div>
                                </div>
                                <a href="#" style="font-size: 12px; color: #3a5ba9; text-decoration: none;">Download</a>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 14px; color: #1f2937;">Invoice #MED-2023-001</div>
                                    <div style="font-size: 12px; color: #6b7280;">May 1, 2023 - $1,188.00</div>
                                </div>
                                <a href="#" style="font-size: 12px; color: #3a5ba9; text-decoration: none;">Download</a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer with save button -->
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
                    <button id="cancel-settings-btn" style="padding: 8px 16px; background-color: #f0f2f5; color: #4b5563; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-right: 10px;">Cancel</button>
                    <button id="save-settings-btn" style="padding: 8px 16px; background-color: #3a5ba9; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    
    // Append the modal content to the container
    modalContainer.appendChild(modalContent);
    
    // Append the modal to the document body
    document.body.appendChild(modalContainer);
    
    // Add event listeners
    
    // Tab switching
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => {
                t.classList.remove('active-tab');
                t.style.backgroundColor = 'transparent';
                t.style.color = '#4b5563';
                t.style.fontWeight = '400';
            });
            
            // Add active class to clicked tab
            this.classList.add('active-tab');
            this.style.backgroundColor = 'rgba(58, 91, 169, 0.05)';
            this.style.color = '#1a3c87';
            this.style.fontWeight = '500';
            
            // Hide all content
            const contents = document.querySelectorAll('.settings-content');
            contents.forEach(content => {
                content.style.display = 'none';
            });
            
            // Show clicked tab's content
            const contentId = this.dataset.tab + '-tab';
            const content = document.getElementById(contentId);
            if (content) {
                content.style.display = 'block';
            }
        });
    });
    
    // Close button
    const closeBtn = document.getElementById('close-settings-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            closeSettingsModal();
        });
    }
    
    // Save button
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            saveSettings();
        });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-settings-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            closeSettingsModal();
        });
    }
    
    // Two-factor authentication toggle
    const twoFactorToggle = document.getElementById('two-factor-auth');
    if (twoFactorToggle) {
        twoFactorToggle.addEventListener('change', function() {
            const toggleSpan = this.nextElementSibling.nextElementSibling;
            if (this.checked) {
                toggleSpan.style.transform = 'translateX(20px)';
                this.nextElementSibling.style.backgroundColor = '#10b981';
            } else {
                toggleSpan.style.transform = 'translateX(0)';
                this.nextElementSibling.style.backgroundColor = '#d1d5db';
            }
        });
    }
    
    // Close modal when clicking outside
    modalContainer.addEventListener('click', function(e) {
        if (e.target === modalContainer) {
            closeSettingsModal();
        }
    });
    
    // Initialize settings from localStorage
    loadSettings();
}

// Show the settings modal with user data
function showSettingsModal() {
    // Get the modal element
    const modal = document.getElementById('settings-modal');
    if (!modal) {
        createSettingsModal();
        setTimeout(showSettingsModal, 100); // Try again after modal is created
        return;
    }
    
    // Show the modal with animation
    modal.style.display = 'block';
    setTimeout(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'translate(-50%, -50%) scale(1)';
        }
    }, 10);
}

// Close the settings modal
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    
    // Hide with animation
    modal.style.opacity = '0';
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }
    
    // Remove from DOM after animation
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Load settings from localStorage
function loadSettings() {
    // General settings
    const defaultDashboard = localStorage.getItem('defaultDashboard') || 'patients';
    const autoSave = localStorage.getItem('autoSave') === 'true';
    const confirmLogout = localStorage.getItem('confirmLogout') !== 'false'; // Default true
    const sessionTimeout = localStorage.getItem('sessionTimeout') || '30';
    const language = localStorage.getItem('language') || 'en';
    const timeFormat = localStorage.getItem('timeFormat') || '12h';
    const dateFormat = localStorage.getItem('dateFormat') || 'mdy';
    
    // Clinical preferences
    const defaultNoteFormat = localStorage.getItem('defaultNoteFormat') || 'narrative';
    const verbosityLevel = localStorage.getItem('verbosityLevel') || 'concise';
    const includeNegatives = localStorage.getItem('includeNegatives') !== 'false'; // Default true
    const autoCode = localStorage.getItem('autoCode') !== 'false'; // Default true
    const specialty = localStorage.getItem('userSpecialty') || 'allergist';
    const customizeInsights = localStorage.getItem('customizeInsights') !== 'false'; // Default true
    
    // Notification settings
    const emailDailySummary = localStorage.getItem('emailDailySummary') !== 'false'; // Default true
    const emailPatientReminders = localStorage.getItem('emailPatientReminders') !== 'false'; // Default true
    const emailSystemUpdates = localStorage.getItem('emailSystemUpdates') !== 'false'; // Default true
    const emailMarketing = localStorage.getItem('emailMarketing') === 'true'; // Default false
    
    // Set form values
    setSelectValue('default-dashboard', defaultDashboard);
    setCheckboxValue('auto-save', autoSave);
    setCheckboxValue('confirm-logout', confirmLogout);
    setSelectValue('session-timeout', sessionTimeout);
    setSelectValue('language-setting', language);
    setSelectValue('time-format', timeFormat);
    setSelectValue('date-format', dateFormat);
    
    setSelectValue('default-note-format', defaultNoteFormat);
    setSelectValue('verbosity-level', verbosityLevel);
    setCheckboxValue('include-negatives', includeNegatives);
    setCheckboxValue('auto-code', autoCode);
    setSelectValue('specialty-setting', specialty.toLowerCase());
    setCheckboxValue('customize-insights', customizeInsights);
    
    setCheckboxValue('email-daily-summary', emailDailySummary);
    setCheckboxValue('email-patient-reminders', emailPatientReminders);
    setCheckboxValue('email-system-updates', emailSystemUpdates);
    setCheckboxValue('email-marketing', emailMarketing);
    
    // Two-factor authentication toggle
    const twoFactorAuth = localStorage.getItem('twoFactorAuth') === 'true';
    const twoFactorToggle = document.getElementById('two-factor-auth');
    if (twoFactorToggle) {
        twoFactorToggle.checked = twoFactorAuth;
        const toggleSpan = twoFactorToggle.nextElementSibling.nextElementSibling;
        if (twoFactorAuth) {
            toggleSpan.style.transform = 'translateX(20px)';
            twoFactorToggle.nextElementSibling.style.backgroundColor = '#10b981';
        } else {
            toggleSpan.style.transform = 'translateX(0)';
            twoFactorToggle.nextElementSibling.style.backgroundColor = '#d1d5db';
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    // General settings
    localStorage.setItem('defaultDashboard', getSelectValue('default-dashboard'));
    localStorage.setItem('autoSave', getCheckboxValue('auto-save'));
    localStorage.setItem('confirmLogout', getCheckboxValue('confirm-logout'));
    localStorage.setItem('sessionTimeout', getSelectValue('session-timeout'));
    localStorage.setItem('language', getSelectValue('language-setting'));
    localStorage.setItem('timeFormat', getSelectValue('time-format'));
    localStorage.setItem('dateFormat', getSelectValue('date-format'));
    
    // Clinical preferences
    localStorage.setItem('defaultNoteFormat', getSelectValue('default-note-format'));
    localStorage.setItem('verbosityLevel', getSelectValue('verbosity-level'));
    localStorage.setItem('includeNegatives', getCheckboxValue('include-negatives'));
    localStorage.setItem('autoCode', getCheckboxValue('auto-code'));
    
    // Update specialty with proper capitalization
    const specialtyValue = getSelectValue('specialty-setting');
    if (specialtyValue) {
        localStorage.setItem('userSpecialty', capitalizeFirstLetter(specialtyValue));
    }
    
    localStorage.setItem('customizeInsights', getCheckboxValue('customize-insights'));
    
    // Notification settings
    localStorage.setItem('emailDailySummary', getCheckboxValue('email-daily-summary'));
    localStorage.setItem('emailPatientReminders', getCheckboxValue('email-patient-reminders'));
    localStorage.setItem('emailSystemUpdates', getCheckboxValue('email-system-updates'));
    localStorage.setItem('emailMarketing', getCheckboxValue('email-marketing'));
    
    // Two-factor authentication
    localStorage.setItem('twoFactorAuth', getCheckboxValue('two-factor-auth'));
    
    // Show success message
    showSettingsSuccessMessage();
    
    // Close modal after delay
    setTimeout(closeSettingsModal, 1500);
}

// Helper function to set select value
function setSelectValue(id, value) {
    const element = document.getElementById(id);
    if (element && value) {
        element.value = value;
    }
}

// Helper function to set checkbox value
function setCheckboxValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.checked = value;
    }
}

// Helper function to get select value
function getSelectValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

// Helper function to get checkbox value
function getCheckboxValue(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
}

// Show success message
function showSettingsSuccessMessage() {
    // Check if message already exists
    if (document.getElementById('settings-success-message')) return;
    
    // Create success message
    const message = document.createElement('div');
    message.id = 'settings-success-message';
    message.style.position = 'fixed';
    message.style.bottom = '20px';
    message.style.right = '20px';
    message.style.backgroundColor = '#10b981';
    message.style.color = '#fff';
    message.style.padding = '12px 20px';
    message.style.borderRadius = '6px';
    message.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    message.style.zIndex = '2500';
    message.style.opacity = '0';
    message.style.transform = 'translateY(20px)';
    message.style.transition = 'opacity 0.3s, transform 0.3s';
    message.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="font-size: 16px; margin-right: 10px;">✓</span>
            <span style="font-size: 14px;">Settings saved successfully!</span>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(message);
    
    // Show with animation
    setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }, 3000);
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Export function to show settings modal
window.showSettingsModal = showSettingsModal;
