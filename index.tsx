
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';
// @ts-ignore
import { jsPDF } from 'jspdf';

// --- DATABASE CONFIGURATION ---
// IMPORTANT: This connection string is for a backend server ONLY.
// It is included here for reference but MUST NOT be used in frontend code.
// Exposing this in a browser is a major security risk.
const MONGO_DB_CONNECTION_STRING = "mongodb+srv://Ravikumar:Ravikumar@cluster0.evxvn1d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


// --- TYPES ---
type Patient = {
    name: string;
    age: string;
    gender: 'Male' | 'Female' | 'Other' | '';
    contact?: string;
    email?: string;
};

type PredictionResult = {
    predictedDisease: string;
    description: string;
    precautions: string[];
    medications: string[];
    diet: string[];
    disclaimer: string;
};

type Report = {
    id: string;
    date: string;
    patient: Patient;
    symptoms: string[];
    result: PredictionResult;
    image?: string;
};

type Page = 'home' | 'form' | 'symptoms' | 'result' | 'reports' | 'loading';

// --- CONSTANTS ---
// Fix: Per coding guidelines, the API key must be obtained from process.env.API_KEY.
// This also resolves the TypeScript error "Property 'env' does not exist on type 'ImportMeta'".
// const API_KEY = process.env.API_KEY;
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = `<div class="flex items-center justify-center h-screen">
            <div class="text-center p-8 bg-white rounded-lg shadow-xl">
                <h1 class="text-2xl font-bold text-red-600">Configuration Error</h1>
                <p class="mt-2 text-gray-700">API key not found. Please ensure the API_KEY environment variable is set.</p>
            </div>
        </div>`;
    }
    throw new Error("API_KEY is not set. Please ensure it is configured in your environment.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYMPTOMS_LIST = [
    'itching', 'skin_rash', 'nodal_skin_eruptions', 'continuous_sneezing', 'shivering', 'chills', 'joint_pain',
    'stomach_pain', 'acidity', 'ulcers_on_tongue', 'muscle_wasting', 'vomiting', 'burning_micturition',
    'spotting_urination', 'fatigue', 'weight_gain', 'anxiety', 'cold_hands_and_feets', 'mood_swings',
    'weight_loss', 'restlessness', 'lethargy', 'patches_in_throat', 'irregular_sugar_level', 'cough',
    'high_fever', 'sunken_eyes', 'breathlessness', 'sweating', 'dehydration', 'indigestion', 'headache',
    'yellowish_skin', 'dark_urine', 'nausea', 'loss_of_appetite', 'pain_behind_the_eyes', 'back_pain',
    'constipation', 'abdominal_pain', 'diarrhoea', 'mild_fever', 'yellow_urine', 'yellowing_of_eyes',
    'acute_liver_failure', 'fluid_overload', 'swelling_of_stomach', 'swelled_lymph_nodes', 'malaise',
    'blurred_and_distorted_vision', 'phlegm', 'throat_irritation', 'redness_of_eyes', 'sinus_pressure',
    'runny_nose', 'congestion', 'chest_pain', 'weakness_in_limbs', 'fast_heart_rate', 'pain_during_bowel_movements',
    'pain_in_anal_region', 'bloody_stool', 'irritation_in_anus', 'neck_pain', 'dizziness', 'cramps',
    'bruising', 'obesity', 'swollen_legs', 'swollen_blood_vessels', 'puffy_face_and_eyes', 'enlarged_thyroid',
    'brittle_nails', 'swollen_extremeties', 'excessive_hunger', 'extra_marital_contacts',
    'drying_and_tingling_lips', 'slurred_speech', 'knee_pain', 'hip_joint_pain', 'muscle_weakness',
    'stiff_neck', 'swelling_joints', 'movement_stiffness', 'spinning_movements', 'loss_of_balance',
    'unsteadiness', 'weakness_of_one_body_side', 'loss_of_smell', 'bladder_discomfort',
    'foul_smell_of_urine', 'continuous_feel_of_urine', 'passage_of_gases', 'internal_itching', 'toxic_look_(typhos)',
    'depression', 'irritability', 'muscle_pain', 'altered_sensorium', 'red_spots_over_body', 'belly_pain',
    'abnormal_menstruation', 'dischromic_patches', 'watering_from_eyes', 'increased_appetite', 'polyuria',
    'family_history', 'mucoid_sputum', 'rusty_sputum', 'lack_of_concentration', 'visual_disturbances',
    'receiving_blood_transfusion', 'receiving_unsterile_injections', 'coma', 'stomach_bleeding',
    'distention_of_abdomen', 'history_of_alcohol_consumption', 'fluid_overload', 'blood_in_sputum',
    'prominent_veins_on_calf', 'palpitations', 'painful_walking', 'pus_filled_pimples', 'blackheads',
    'scurring', 'skin_peeling', 'silver_like_ dusting', 'small_dents_in_nails', 'inflammatory_nails',
    'blister', 'red_sore_around_nose', 'yellow_crust_ooze'
];

// --- HELPER FUNCTIONS ---
const formatSymptom = (symptom: string) => {
    return symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// --- DATA PERSISTENCE ---
async function fetchReportsFromDb(): Promise<Report[]> {
    console.log("Fetching reports from localStorage...");
    try {
        const reportsJson = localStorage.getItem('medical_reports');
        if (reportsJson) {
            const reports = JSON.parse(reportsJson) as Report[];
            return reports.sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());
        }
        return [];
    } catch (error) {
        console.error("Could not fetch or parse reports from localStorage:", error);
        return [];
    }
}

async function saveReportToDb(report: Report): Promise<void> {
    console.log("Saving report to localStorage...", report);
    try {
        const existingReports = await fetchReportsFromDb();
        const newReports = [report, ...existingReports];
        localStorage.setItem('medical_reports', JSON.stringify(newReports));
        console.log("Report saved successfully to localStorage.");
    } catch (error) {
        console.error("Could not save the report to localStorage:", error);
    }
}

// --- GEMINI API CALL ---
async function getPrediction(symptoms: string[], image: string | null): Promise<PredictionResult> {
    const systemInstruction = `You are an AI medical assistant. Based on a list of symptoms, and potentially an image of a physical symptom (like a rash), predict a possible disease.
    Provide a brief description, 4-5 precautions, 2-3 potential medications, and a suitable diet plan.
    The output must be a valid JSON object with the exact structure defined in the schema. Do not add any extra text or markdown formatting.`;

    const textPrompt = `Analyze the following symptoms: ${symptoms.join(', ')}. If an image is provided, use it as additional context for physical symptoms.`;

    const config = {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                predictedDisease: { type: Type.STRING },
                description: { type: Type.STRING },
                precautions: { type: Type.ARRAY, items: { type: Type.STRING } },
                medications: { type: Type.ARRAY, items: { type: Type.STRING } },
                diet: { type: Type.ARRAY, items: { type: Type.STRING } },
                disclaimer: { type: Type.STRING },
            },
            required: ["predictedDisease", "description", "precautions", "medications", "diet", "disclaimer"]
        }
    };

    let generationRequest;

    if (image) {
        const [mimeTypePart, base64Data] = image.split(';base64,');
        const mimeType = mimeTypePart.split(':')[1];
        
        const imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: base64Data,
            },
        };
        const textPart = { text: textPrompt };

        generationRequest = {
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: config
        };
    } else {
        generationRequest = {
            model: "gemini-2.5-flash",
            contents: textPrompt,
            config: config
        };
    }

    try {
        const response = await ai.models.generateContent(generationRequest);
        
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7, jsonText.length - 3).trim();
        } else if (jsonText.startsWith('```')) {
             jsonText = jsonText.substring(3, jsonText.length - 3).trim();
        }

        const result = JSON.parse(jsonText);
        if (!result.predictedDisease) {
            throw new Error("The AI model returned an incomplete response. Please try again.");
        }
        return result;
    } catch (error) {
        console.error("Error fetching or parsing prediction:", error);
        throw new Error("The AI service could not process your request. This might be a temporary issue with the service or your network connection. Please try again.");
    }
}

// --- LAYOUT COMPONENTS ---
const Header = ({ onNavigate, onNewDiagnosis, onViewReports }: {
    onNavigate: (page: Page) => void;
    onNewDiagnosis: () => void;
    onViewReports: () => void;
}) => (
    <header className="header shadow-md">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('home')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                <span className="text-2xl font-bold text-gray-800">MediPredict AI</span>
            </div>
            <div className="flex items-center space-x-4">
                 <div className="hidden md:flex items-center space-x-8">
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="text-gray-700 hover:text-blue-600 transition font-medium text-lg">Home</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); onNewDiagnosis(); }} className="text-gray-700 hover:text-blue-600 transition font-medium text-lg">New Diagnosis</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); onViewReports(); }} className="text-gray-700 hover:text-blue-600 transition font-medium text-lg">View Reports</a>
                </div>
            </div>
        </nav>
    </header>
);

const Footer = ({ visitorCount, onProvideFeedback }: { visitorCount: number; onProvideFeedback: () => void; }) => (
    <footer className="bg-gray-800 text-white text-center p-6 mt-auto">
        <div className="container mx-auto">
            <p className="text-sm text-gray-400 mb-2">
                This tool is for informational purposes only and is not a substitute for professional medical advice.
            </p>
            <div className="flex justify-center items-center space-x-4 flex-wrap">
                 <p className="font-semibold">&copy; 2024 MediPredict AI. All rights reserved.</p>
                 <span className="text-gray-500 hidden sm:inline">|</span>
                 <button 
                    onClick={onProvideFeedback}
                    className="text-sm text-gray-400 hover:text-white hover:underline transition"
                    aria-label="Provide feedback"
                 >
                    Provide Feedback
                 </button>
                 <span className="text-gray-500 hidden sm:inline">|</span>
                 <a 
                    href="mailto:contact@medipredict.ai?subject=Contact%20from%20MediPredict%20AI" 
                    className="text-sm text-gray-400 hover:text-white hover:underline transition"
                    aria-label="Contact us via email"
                 >
                    Contact Us
                 </a>
                 <span className="text-gray-500 hidden sm:inline">|</span>
                 <p className="text-sm text-gray-400">Page Visitors: {visitorCount}</p>
            </div>
        </div>
    </footer>
);


// Fix: Replaced JSX.Element with React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
const Feature = ({ icon, title, description }: { icon: React.ReactElement, title: string, description: string }) => (
    <div className="text-center p-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
            {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="mt-1 text-gray-600">{description}</p>
    </div>
);

// --- PAGE COMPONENTS ---

const HomePage = ({ onStart, onViewReports }: { onStart: () => void; onViewReports: () => void; }) => (
    <div className="w-full">
        <div className="card text-center p-8 md:p-12 max-w-4xl mx-auto mt-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">AI-Powered Disease Prediction</h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Get a preliminary diagnosis based on your symptoms using advanced AI. Our system analyzes your inputs to provide instant, informative results.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={onStart} className="btn-primary text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg w-full sm:w-auto">
                    Start Diagnosis
                </button>
                <button onClick={onViewReports} className="bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-full text-lg shadow-lg w-full sm:w-auto hover:bg-gray-300 transition">
                    View Past Reports
                </button>
            </div>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 mt-16 text-center px-4">
             <Feature 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Instant Results"
                description="Receive an AI-driven prediction within seconds after providing your symptoms."
            />
             <Feature 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Secure & Private"
                description="Your data is processed securely. All reports are stored locally on your device."
            />
            <Feature 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                title="Downloadable Reports"
                description="Export your prediction results as a PDF document for your personal records."
            />
        </div>
    </div>
);

const PatientForm = ({ onSubmit, onBack }: { onSubmit: (patient: Patient) => void; onBack: () => void; }) => {
    const [patient, setPatient] = useState<Patient>({ name: '', age: '', gender: '', contact: '', email: '' });
    const [errors, setErrors] = useState<Partial<Record<keyof Patient, string>>>({});

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof Patient, string>> = {};
        if (!patient.name.trim()) newErrors.name = "Full Name is required.";
        else if (patient.name.trim().length < 2) newErrors.name = "Name must be at least 2 characters.";

        if (!patient.age) newErrors.age = "Age is required.";
        else if (isNaN(Number(patient.age)) || Number(patient.age) <= 0 || Number(patient.age) > 120) newErrors.age = "Please enter a valid age.";

        if (!patient.gender) newErrors.gender = "Please select a gender.";

        if (patient.email && !/^\S+@\S+\.\S+$/.test(patient.email)) newErrors.email = "Please enter a valid email address.";
        if (patient.contact && !/^\+?[0-9\s-]{7,15}$/.test(patient.contact)) newErrors.contact = "Please enter a valid contact number.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(patient);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPatient({ ...patient, [name]: value });
        if (errors[name as keyof Patient]) {
            setErrors({ ...errors, [name]: undefined });
        }
    };

    return (
        <div className="card w-full max-w-lg p-8">
            <button onClick={onBack} className="text-blue-500 hover:underline mb-4">&larr; Back to Home</button>
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Patient Information</h2>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                    <input type="text" name="name" placeholder="Full Name" value={patient.name} onChange={handleChange} className={`w-full p-3 border rounded-lg ${errors.name ? 'input-error' : 'border-gray-300'}`} required />
                    {errors.name && <p className="error-text">{errors.name}</p>}
                </div>
                <div>
                    <input type="number" name="age" placeholder="Age" value={patient.age} onChange={handleChange} className={`w-full p-3 border rounded-lg ${errors.age ? 'input-error' : 'border-gray-300'}`} required />
                    {errors.age && <p className="error-text">{errors.age}</p>}
                </div>
                <div>
                    <select name="gender" value={patient.gender} onChange={handleChange} className={`w-full p-3 border rounded-lg ${errors.gender ? 'input-error' : 'border-gray-300'}`} required>
                        <option value="" disabled>Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                    {errors.gender && <p className="error-text">{errors.gender}</p>}
                </div>
                <div>
                    <input type="tel" name="contact" placeholder="Contact (Optional)" value={patient.contact} onChange={handleChange} className={`w-full p-3 border rounded-lg ${errors.contact ? 'input-error' : 'border-gray-300'}`} />
                    {errors.contact && <p className="error-text">{errors.contact}</p>}
                </div>
                <div>
                    <input type="email" name="email" placeholder="Email (Optional)" value={patient.email} onChange={handleChange} className={`w-full p-3 border rounded-lg ${errors.email ? 'input-error' : 'border-gray-300'}`} />
                    {errors.email && <p className="error-text">{errors.email}</p>}
                </div>
                <button type="submit" className="w-full btn-primary text-white font-bold py-3 px-6 rounded-lg text-lg shadow-md">
                    Next: Select Symptoms
                </button>
            </form>
        </div>
    );
};

const SymptomSelector = ({ onPredict, onBack, isLoading }: { onPredict: (symptoms: string[], image: string | null) => void; onBack: () => void; isLoading: boolean; }) => {
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleToggle = (symptom: string) => {
        setSelectedSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageUploadClick = () => {
        fileInputRef.current?.click();
    };

    const filteredSymptoms = SYMPTOMS_LIST.filter(s =>
        s.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
    );

    const suggestions = searchTerm.length > 1
        ? SYMPTOMS_LIST.filter(s =>
            s.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase()) && !selectedSymptoms.includes(s)
        ).slice(0, 5)
        : [];

    const handleSuggestionClick = (symptom: string) => {
        handleToggle(symptom);
        setSearchTerm('');
        setShowSuggestions(false);
    };
    
    return (
        <div className="card w-full max-w-4xl p-8 flex flex-col" style={{minHeight: '80vh'}}>
            <button onClick={onBack} className="text-blue-500 hover:underline mb-4 self-start">&larr; Back to Patient Form</button>
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Select Your Symptoms</h2>
            <p className="text-center text-gray-500 mb-4">Please select all symptoms you are experiencing.</p>
            
            <div className="relative">
                <input 
                    type="text"
                    placeholder="Search for a symptom..."
                    className="w-full p-3 border border-gray-300 rounded-lg mb-4 sticky top-4 bg-white z-20"
                    value={searchTerm}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="suggestions-list"
                />
                {showSuggestions && suggestions.length > 0 && (
                    <ul 
                        id="suggestions-list"
                        className="absolute top-full -mt-4 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg z-30" 
                        role="listbox"
                    >
                        {suggestions.map(symptom => (
                            <li key={symptom}>
                                <button
                                    onMouseDown={() => handleSuggestionClick(symptom)}
                                    className="w-full text-left p-3 hover:bg-gray-100 cursor-pointer"
                                    role="option"
                                >
                                    {formatSymptom(symptom)}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="border-t border-b border-gray-200 py-4 my-4">
                <h3 className="text-lg font-semibold text-gray-700 text-center mb-3">Add a Photo (Optional)</h3>
                <p className="text-center text-gray-500 mb-4 text-sm">If you have a visible symptom like a skin rash, add a photo for a more accurate prediction.</p>
                {image ? (
                    <div className="relative w-48 h-48 mx-auto">
                        <img src={image} alt="Symptom preview" className="w-full h-full object-cover rounded-lg shadow-md" />
                        <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-lg hover:bg-red-600 transition">&times;</button>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <button onClick={handleImageUploadClick} className="flex items-center gap-2 bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-full hover:bg-gray-300 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                            Upload or Capture Photo
                        </button>
                    </div>
                )}
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredSymptoms.map(symptom => (
                        <div key={symptom}>
                            <input
                                type="checkbox"
                                id={symptom}
                                className="hidden symptom-checkbox"
                                checked={selectedSymptoms.includes(symptom)}
                                onChange={() => handleToggle(symptom)}
                            />
                            <label
                                htmlFor={symptom}
                                className="block p-3 border border-gray-300 rounded-lg text-center cursor-pointer transition-colors duration-200"
                            >
                                {formatSymptom(symptom)}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            
            <button
                onClick={() => onPredict(selectedSymptoms, image)}
                className="w-full mt-6 btn-primary text-white font-bold py-3 px-6 rounded-lg text-lg shadow-md disabled:bg-gray-400"
                disabled={isLoading || selectedSymptoms.length < 2}
            >
                {isLoading ? 'Predicting...' : 'Predict Disease'}
            </button>
            {selectedSymptoms.length < 2 && <p className="text-center text-sm text-gray-500 mt-2">Please select at least 2 symptoms.</p>}
        </div>
    );
};

const ResultPageContent = ({ result, patient, symptoms, image }: { result: PredictionResult; patient: Patient, symptoms: string[], image: string | null }) => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 border-b border-gray-200 pb-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Patient Details</h3>
                <p><strong>Name:</strong> {patient.name}</p>
                <p><strong>Age:</strong> {patient.age}</p>
                <p><strong>Gender:</strong> {patient.gender}</p>
                {patient.contact && <p><strong>Contact:</strong> {patient.contact}</p>}
                {patient.email && <p><strong>Email:</strong> {patient.email}</p>}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Reported Symptoms</h3>
                <div className="flex flex-wrap gap-2">
                    {symptoms.map(s => <span key={s} className="bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">{formatSymptom(s)}</span>)}
                </div>
            </div>
        </div>
        
        {image && (
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Symptom Image Provided</h3>
                <img src={image} alt="Symptom" className="rounded-lg shadow-md max-h-64 mx-auto"/>
            </div>
        )}

        <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold text-blue-800">Predicted Disease:</h3>
            <p className="text-2xl font-bold text-blue-900">{result.predictedDisease}</p>
             <p className="mt-2 text-gray-600">{result.description}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6 text-left">
            <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-bold text-green-800 mb-2">Precautions</h4>
                <ul className="list-disc list-inside text-green-700 space-y-1">
                    {result.precautions.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-bold text-yellow-800 mb-2">Medications</h4>
                 <ul className="list-disc list-inside text-yellow-700 space-y-1">
                    {result.medications.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-bold text-red-800 mb-2">Diet</h4>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                    {result.diet.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
            </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg text-center text-sm text-gray-600 mb-6">
            <p><strong>Disclaimer:</strong> {result.disclaimer}</p>
        </div>
    </>
);


const ResultPage = ({ result, patient, symptoms, image, onDownload, onNewDiagnosis }: { result: PredictionResult; patient: Patient; symptoms: string[]; image: string | null; onDownload: () => void; onNewDiagnosis: () => void; }) => {
    if (!result || !patient) return null;

    const isError = result.predictedDisease === "Prediction Failed";

    if (isError) {
        return (
            <div className="card w-full max-w-4xl p-8 text-center">
                <h2 className="text-3xl font-bold text-red-600 mb-4">Prediction Failed</h2>
                <div className="bg-red-50 p-6 rounded-lg mb-6">
                    <p className="text-lg text-red-800">{result.description}</p>
                </div>
                <div className="mt-8">
                    <button onClick={onNewDiagnosis} className="btn-primary text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg">
                        Start New Diagnosis
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="card w-full max-w-4xl p-8">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Prediction Result</h2>
            <ResultPageContent result={result} patient={patient} symptoms={symptoms} image={image} />
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <button onClick={onDownload} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg">
                    Download Medical Report
                </button>
                 <button onClick={onNewDiagnosis} className="btn-primary text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg">
                    Start New Diagnosis
                </button>
            </div>
        </div>
    );
};

const ReportDetailModal = ({ report, onClose }: { report: Report; onClose: () => void }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Report Details</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Report generated on {report.date}</p>
            <ResultPageContent result={report.result} patient={report.patient} symptoms={report.symptoms} image={report.image || null} />
        </div>
    </div>
);

const FeedbackModal = ({ onClose }: { onClose: () => void }) => {
    const [feedbackType, setFeedbackType] = useState('Suggestion');
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            alert("Please enter your feedback before submitting.");
            return;
        }
        console.log("Feedback submitted:", {
            type: feedbackType,
            message: message,
        });
        alert("Thank you for your feedback! It has been submitted.");
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content !max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Provide Feedback</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="feedbackType" className="block text-sm font-medium text-gray-700 mb-1">Feedback Type</label>
                        <select 
                            id="feedbackType" 
                            name="feedbackType"
                            value={feedbackType}
                            onChange={(e) => setFeedbackType(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                            <option>Suggestion</option>
                            <option>Bug Report</option>
                            <option>General Comment</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea 
                            id="message" 
                            name="message" 
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Please share your thoughts..."
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-300 transition">
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary text-white font-bold py-2 px-6 rounded-lg shadow-md">
                            Submit Feedback
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AuthModal = ({ onClose, onUserLogin, onAdminLogin }: {
    onClose: () => void;
    onUserLogin: (name: string, age: string) => Promise<boolean>;
    onAdminLogin: (user: string, pass: string) => Promise<boolean>;
}) => {
    const [step, setStep] = useState<'select_role' | 'user_login' | 'admin_login'>('select_role');
    const [error, setError] = useState('');

    const [fullName, setFullName] = useState('');
    const [age, setAge] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!fullName.trim() || !age.trim()) {
            setError('Please provide your full name and age.');
            return;
        }
        const success = await onUserLogin(fullName, age);
        if (!success) {
            setError('No reports found matching these details. Please check and try again.');
        }
    };
    
    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !password) {
            setError('Please provide a username and password.');
            return;
        }
        const success = await onAdminLogin(username, password);
        if (!success) {
            setError('Invalid credentials.');
        }
    };

    const resetForms = () => {
        setError('');
        setFullName('');
        setAge('');
        setUsername('');
        setPassword('');
    };

    const renderContent = () => {
        switch(step) {
            case 'user_login':
                return (
                    <div>
                        <button onClick={() => { setStep('select_role'); resetForms(); }} className="text-blue-500 hover:underline mb-4 text-sm">&larr; Back to role selection</button>
                        <h3 className="text-xl font-bold text-center text-gray-800 mb-4">Patient Verification</h3>
                        <p className="text-center text-gray-500 mb-6 text-sm">Enter your details to view your personal reports.</p>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="w-full p-3 border border-gray-300 rounded-lg" />
                            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Age" className="w-full p-3 border border-gray-300 rounded-lg" />
                            {error && <p className="error-text text-center">{error}</p>}
                            <button type="submit" className="w-full btn-primary text-white font-bold py-3 px-6 rounded-lg text-lg shadow-md">View My Reports</button>
                        </form>
                    </div>
                );
            case 'admin_login':
                 return (
                    <div>
                        <button onClick={() => { setStep('select_role'); resetForms(); }} className="text-blue-500 hover:underline mb-4 text-sm">&larr; Back to role selection</button>
                        <h3 className="text-xl font-bold text-center text-gray-800 mb-4">Administrator Login</h3>
                        <p className="text-center text-gray-500 mb-6 text-sm">Enter your credentials to view all patient reports.</p>
                        <form onSubmit={handleAdminSubmit} className="space-y-4">
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full p-3 border border-gray-300 rounded-lg" />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 border border-gray-300 rounded-lg" />
                            {error && <p className="error-text text-center">{error}</p>}
                            <button type="submit" className="w-full btn-primary text-white font-bold py-3 px-6 rounded-lg text-lg shadow-md">Login & View All Reports</button>
                        </form>
                    </div>
                );
            case 'select_role':
            default:
                return (
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">View Past Reports</h3>
                        <p className="text-gray-600 mb-6">Please select your role to continue.</p>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => setStep('user_login')} className="w-full bg-blue-100 text-blue-800 font-bold py-4 px-6 rounded-lg text-lg shadow-sm hover:bg-blue-200 transition">I am a Patient</button>
                            <button onClick={() => setStep('admin_login')} className="w-full bg-gray-200 text-gray-800 font-bold py-4 px-6 rounded-lg text-lg shadow-sm hover:bg-gray-300 transition">I am an Admin</button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content !max-w-md" onClick={(e) => e.stopPropagation()}>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Authentication</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

const ReportsPage = ({ reports, onBack }: { reports: Report[]; onBack: () => void; }) => {
    const [viewingReport, setViewingReport] = useState<Report | null>(null);

    const handleExportAll = () => {
        const doc = new jsPDF();
        
        const addFooter = () => {
            const pageCount = doc.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                const pageHeight = doc.internal.pageSize.height;
                doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
                doc.text("This is an AI-generated report and not a substitute for professional medical advice.", 20, pageHeight - 10);
            }
        };
        
        reports.forEach((report, index) => {
            if (index > 0) {
                doc.addPage();
            }

            let yPos = 20;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;

            const checkPageBreak = (spaceNeeded: number) => {
                if (yPos + spaceNeeded > pageHeight - 20) {
                    doc.addPage();
                    yPos = margin;
                }
            };

            // Header for each report page
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("AI Medical Report", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
            yPos += 12;
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Report Date: ${report.date}`, margin, yPos);
            yPos += 10;
            doc.setDrawColor(200);
            doc.line(margin, yPos - 5, doc.internal.pageSize.width - margin, yPos - 5);

            // Patient Info
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Patient Information", margin, yPos);
            yPos += 8;
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text(`Name: ${report.patient.name}`, margin + 5, yPos);
            doc.text(`Age: ${report.patient.age}`, margin + 90, yPos);
            yPos += 7;
            doc.text(`Gender: ${report.patient.gender}`, margin + 5, yPos);
            if (report.patient.contact) doc.text(`Contact: ${report.patient.contact}`, margin + 90, yPos);
            yPos += 7;
            if (report.patient.email) doc.text(`Email: ${report.patient.email}`, margin + 5, yPos);
            yPos += 10;
            
            // Symptoms
            checkPageBreak(20);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Symptoms Provided", margin, yPos);
            yPos += 8;
            doc.setFontSize(12);
            const symptomsText = doc.splitTextToSize(report.symptoms.map(formatSymptom).join(', '), doc.internal.pageSize.width - margin * 2 - 5);
            doc.text(symptomsText, margin + 5, yPos);
            yPos += (symptomsText.length * 5) + 5;

            // Prediction Result
            checkPageBreak(50);
            doc.setFillColor(235, 245, 255);
            doc.rect(margin, yPos, doc.internal.pageSize.width - margin * 2, 25, 'F');
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 102, 204);
            doc.text("Prediction Result", margin + 5, yPos + 8);
            doc.setFontSize(18);
            doc.text(report.result.predictedDisease, margin + 5, yPos + 18);
            yPos += 30;
            doc.setTextColor(0);
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            const descriptionText = doc.splitTextToSize(report.result.description, doc.internal.pageSize.width - margin * 2 - 5);
            doc.text(descriptionText, margin + 5, yPos);
            yPos += (descriptionText.length * 5) + 10;
            
            const drawList = (title: string, items: string[], color: [number, number, number]) => {
                checkPageBreak(items.length * 6 + 10);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...color);
                doc.text(title, margin + 5, yPos);
                yPos += 7;
                doc.setTextColor(0);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(12);
                items.forEach(item => {
                    checkPageBreak(12);
                    const itemText = doc.splitTextToSize(`- ${item}`, doc.internal.pageSize.width - margin * 2 - 15);
                    doc.text(itemText, margin + 10, yPos);
                    yPos += (itemText.length * 5) + 2;
                });
                yPos += 5;
            };

            drawList("Precautions", report.result.precautions, [34, 139, 34]);
            drawList("Medications", report.result.medications, [255, 165, 0]);
            drawList("Diet", report.result.diet, [220, 20, 60]);

            // Disclaimer
            checkPageBreak(40);
            yPos += 10;
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100);
            doc.text("Important Disclaimer", margin, yPos);
            yPos += 8;
            
            doc.setDrawColor(180);
            doc.setLineWidth(0.2);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80);
            
            const disclaimerText = doc.splitTextToSize(report.result.disclaimer, doc.internal.pageSize.width - margin * 2 - 10);
            const boxHeight = (disclaimerText.length * 5) + 10;
            
            checkPageBreak(boxHeight + 5);
            doc.rect(margin, yPos - 5, doc.internal.pageSize.width - margin * 2, boxHeight, 'S');
            
            doc.text(disclaimerText, margin + 5, yPos);
            yPos += boxHeight;

            // Reset text color for footer
            doc.setTextColor(0);
        });

        addFooter();
        doc.save('All_Patient_Reports.pdf');
    };

    return (
        <>
            <div className="card w-full max-w-4xl p-8">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <div>
                        <button onClick={onBack} className="text-blue-500 hover:underline mb-2 block">&larr; Back to Home</button>
                        <h2 className="text-2xl font-bold text-gray-800">Past Reports</h2>
                    </div>
                    {reports.length > 0 && (
                        <button 
                            onClick={handleExportAll}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center gap-2 transition"
                            aria-label="Export all reports to PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Export All as PDF
                        </button>
                    )}
                </div>
                {reports.length === 0 ? (
                    <p className="text-center text-gray-500">No past reports found.</p>
                ) : (
                    <div className="space-y-4">
                        {reports.map(report => (
                            <div key={report.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{report.patient.name} - <span className="font-bold text-blue-700">{report.result.predictedDisease}</span></p>
                                    <p className="text-sm text-gray-500">{report.date}</p>
                                </div>
                                <button onClick={() => setViewingReport(report)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
                                    View Details
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {viewingReport && <ReportDetailModal report={viewingReport} onClose={() => setViewingReport(null)} />}
        </>
    );
};

const SuccessAnimation = () => (
    <div className="fixed inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
            <p className="text-2xl font-semibold mt-4 text-gray-800 animate-pulse">Prediction Successful!</p>
            <p className="text-gray-600">Generating your report...</p>
        </div>
    </div>
);

const LoadingPage = ({ message }: { message: string }) => (
    <div className="card w-full max-w-md p-8 text-center flex flex-col justify-center items-center" style={{minHeight: '50vh'}}>
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24 mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating Report</h2>
        <p className="text-gray-600 animate-pulse min-h-[48px] flex items-center">{message}</p>
    </div>
);

// --- MAIN APP ---
const App = () => {
    const [page, setPage] = useState<Page>('home');
    const [patient, setPatient] = useState<Patient | null>(null);
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
    const [symptomImage, setSymptomImage] = useState<string | null>(null);
    const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [visitorCount, setVisitorCount] = useState(0);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Analyzing your symptoms...');

    useEffect(() => {
        // We no longer fetch all reports on load, but on demand after auth.
        const currentCount = parseInt(localStorage.getItem('visitorCount') || '0', 10);
        const newCount = currentCount + 1;
        localStorage.setItem('visitorCount', newCount.toString());
        setVisitorCount(newCount);
    }, []);

    const resetState = () => {
        setPatient(null);
        setSelectedSymptoms([]);
        setPredictionResult(null);
        setIsLoading(false);
        setSymptomImage(null);
    };

    const handleNewDiagnosis = () => {
        resetState();
        setPage('form');
    };

    const handleViewReports = () => {
        setIsAuthModalOpen(true);
    };

    const handleUserLoginAttempt = async (name: string, age: string): Promise<boolean> => {
        const allReports = await fetchReportsFromDb();
        const userReports = allReports.filter(report =>
            report.patient.name.toLowerCase().trim() === name.toLowerCase().trim() &&
            report.patient.age.trim() === age.trim()
        );
        if (userReports.length > 0) {
            setReports(userReports);
            setPage('reports');
            setIsAuthModalOpen(false);
            return true;
        }
        return false;
    };

    const handleAdminLoginAttempt = async (user: string, pass: string): Promise<boolean> => {
        const ADMIN_USER = 'admin';
        const ADMIN_PASS = 'password';
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            const allReports = await fetchReportsFromDb();
            setReports(allReports);
            setPage('reports');
            setIsAuthModalOpen(false);
            return true;
        }
        return false;
    };

    const handleFormSubmit = (patientData: Patient) => {
        setPatient(patientData);
        setPage('symptoms');
    };

    const handleStartPrediction = (symptoms: string[], image: string | null) => {
        if (!patient) return;
        setIsLoading(true);
        setSelectedSymptoms(symptoms);
        setSymptomImage(image);
        setLoadingMessage('Analyzing your symptoms...');
        setPage('loading');
    };

    useEffect(() => {
        if (page !== 'loading') {
            return;
        }

        const messages = [
            'Analyzing your symptoms...',
            'Consulting with AI medical knowledge base...',
            'Cross-referencing with medical data...',
            'Compiling potential diagnoses...',
            'Finalizing your report...'
        ];
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, 2000);

        const performPrediction = async () => {
            if (!patient || selectedSymptoms.length < 2) {
                setPage('symptoms');
                setIsLoading(false);
                return;
            }

            try {
                const result = await getPrediction(selectedSymptoms, symptomImage);
                setPredictionResult(result);
                
                const newReport: Report = {
                    id: new Date().toISOString(),
                    date: new Date().toLocaleString(),
                    patient,
                    symptoms: selectedSymptoms,
                    result,
                    image: symptomImage,
                };
                
                await saveReportToDb(newReport);
                setShowSuccessAnimation(true);
        
                setTimeout(() => {
                    setShowSuccessAnimation(false);
                    setPage('result');
                    setIsLoading(false);
                }, 1500);

            } catch (error) {
                console.error("Prediction failed:", error);
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred. Please try again later.";
                const errorResult: PredictionResult = {
                    predictedDisease: "Prediction Failed",
                    description: errorMessage,
                    precautions: [],
                    medications: [],
                    diet: [],
                    disclaimer: "The system was unable to generate a report due to an error."
                };
                setPredictionResult(errorResult);
                setPage('result');
                setIsLoading(false);
            }
        };

        performPrediction();

        return () => {
            clearInterval(intervalId);
        };
    }, [page, patient, selectedSymptoms, symptomImage]);
    
    const handleDownloadPdf = () => {
        if (!patient || !predictionResult) return;
        const doc = new jsPDF();
        let yPos = 20;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;

        const addHeader = () => {
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("AI Medical Report", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
            yPos += 12;
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Report Date: ${new Date().toLocaleString()}`, margin, yPos);
            yPos += 10;
            doc.setDrawColor(200);
            doc.line(margin, yPos - 5, doc.internal.pageSize.width - margin, yPos - 5);
        };

        const addFooter = () => {
            const pageCount = doc.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
                doc.text("This is an AI-generated report and not a substitute for professional medical advice.", margin, pageHeight - 10);
            }
        };

        const checkPageBreak = (spaceNeeded: number) => {
            if (yPos + spaceNeeded > pageHeight - 20) {
                doc.addPage();
                yPos = margin;
            }
        };

        addHeader();

        // Patient Info
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Patient Information", margin, yPos);
        yPos += 8;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${patient.name}`, margin + 5, yPos);
        doc.text(`Age: ${patient.age}`, margin + 90, yPos);
        yPos += 7;
        doc.text(`Gender: ${patient.gender}`, margin + 5, yPos);
        if (patient.contact) doc.text(`Contact: ${patient.contact}`, margin + 90, yPos);
        yPos += 7;
        if (patient.email) doc.text(`Email: ${patient.email}`, margin + 5, yPos);
        yPos += 10;

        // Image
        if (symptomImage) {
            checkPageBreak(60);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("Symptom Image Provided", margin, yPos);
            yPos += 8;
            try {
                const img = new Image();
                img.src = symptomImage;
                // Determine aspect ratio
                const imgWidth = 80;
                const imgHeight = (img.height * imgWidth) / img.width;
                checkPageBreak(imgHeight + 10);
                doc.addImage(symptomImage, 'JPEG', margin + 5, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 10;
            } catch(e) {
                console.error("Error adding image to PDF:", e);
                doc.setFontSize(10);
                doc.setFont("helvetica", "italic");
                doc.text("Could not render the provided image in the PDF.", margin + 5, yPos);
                yPos += 7;
            }
        }


        // Symptoms
        checkPageBreak(20);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Symptoms Provided", margin, yPos);
        yPos += 8;
        doc.setFontSize(12);
        const symptomsText = doc.splitTextToSize(selectedSymptoms.map(formatSymptom).join(', '), doc.internal.pageSize.width - margin * 2 - 5);
        doc.text(symptomsText, margin + 5, yPos);
        yPos += (symptomsText.length * 5) + 5;

        // Prediction Result
        checkPageBreak(50);
        doc.setFillColor(235, 245, 255);
        doc.rect(margin, yPos, doc.internal.pageSize.width - margin * 2, 25, 'F');
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 102, 204);
        doc.text("Prediction Result", margin + 5, yPos + 8);
        doc.setFontSize(18);
        doc.text(predictionResult.predictedDisease, margin + 5, yPos + 18);
        yPos += 30;
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const descriptionText = doc.splitTextToSize(predictionResult.description, doc.internal.pageSize.width - margin * 2 - 5);
        doc.text(descriptionText, margin + 5, yPos);
        yPos += (descriptionText.length * 5) + 10;
        
        // Recommendations
        checkPageBreak(80);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Recommendations", margin, yPos);
        yPos += 10;

        const drawList = (title: string, items: string[], color: [number, number, number]) => {
            checkPageBreak(items.length * 6 + 10);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...color);
            doc.text(title, margin + 5, yPos);
            yPos += 7;
            doc.setTextColor(0);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            items.forEach(item => {
                checkPageBreak(12);
                const itemText = doc.splitTextToSize(`- ${item}`, doc.internal.pageSize.width - margin * 2 - 15);
                doc.text(itemText, margin + 10, yPos);
                yPos += (itemText.length * 5) + 2;
            });
            yPos += 5;
        };

        drawList("Precautions", predictionResult.precautions, [34, 139, 34]); // Green
        drawList("Medications", predictionResult.medications, [255, 165, 0]); // Orange
        drawList("Diet", predictionResult.diet, [220, 20, 60]); // Red

        // Disclaimer
        checkPageBreak(40);
        yPos += 10;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100);
        doc.text("Important Disclaimer", margin, yPos);
        yPos += 8;
        
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        
        const disclaimerText = doc.splitTextToSize(predictionResult.disclaimer, doc.internal.pageSize.width - margin * 2 - 10);
        const boxHeight = (disclaimerText.length * 5) + 10;
        
        doc.rect(margin, yPos - 5, doc.internal.pageSize.width - margin * 2, boxHeight, 'S');
        
        doc.text(disclaimerText, margin + 5, yPos);
        yPos += boxHeight;

        // Reset text color for footer
        doc.setTextColor(0);

        addFooter();
        doc.save(`Medical_Report_${patient.name.replace(/\s/g, '_')}.pdf`);
    };
    
    const renderPage = () => {
        switch (page) {
            case 'form':
                return <PatientForm onSubmit={handleFormSubmit} onBack={() => setPage('home')} />;
            case 'symptoms':
                return <SymptomSelector onPredict={handleStartPrediction} onBack={() => setPage('form')} isLoading={isLoading} />;
            case 'loading':
                return <LoadingPage message={loadingMessage} />;
            case 'result':
                return <ResultPage result={predictionResult!} patient={patient!} symptoms={selectedSymptoms} image={symptomImage} onDownload={handleDownloadPdf} onNewDiagnosis={handleNewDiagnosis} />;
            case 'reports':
                return <ReportsPage reports={reports} onBack={() => setPage('home')} />;
            case 'home':
            default:
                return <HomePage onStart={handleNewDiagnosis} onViewReports={handleViewReports} />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header onNavigate={setPage} onNewDiagnosis={handleNewDiagnosis} onViewReports={handleViewReports} />
            <main className="flex-grow w-full flex justify-center p-4 md:p-8">
                {renderPage()}
            </main>
            <Footer 
                visitorCount={visitorCount}
                onProvideFeedback={() => setIsFeedbackModalOpen(true)}
            />
            {showSuccessAnimation && <SuccessAnimation />}
            {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}
            {isAuthModalOpen && <AuthModal 
                onClose={() => setIsAuthModalOpen(false)} 
                onUserLogin={handleUserLoginAttempt}
                onAdminLogin={handleAdminLoginAttempt}
            />}
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
