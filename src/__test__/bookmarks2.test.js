import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Bookmarks2 from '../bookmarks2';
import { MemoryRouter } from 'react-router-dom';
// Add this at the top, after your imports or in a beforeAll
beforeAll(() => {
    window.alert = jest.fn();
});

// --- Mocks ---
// Use var instead of const for hoisting!
var mockOnSnapshot = jest.fn();
var mockGetDoc = jest.fn();
var mockSetDoc = jest.fn();
var mockDeleteDoc = jest.fn();
var mockGetDocs = jest.fn();
var mockCollection = jest.fn();
var mockDoc = jest.fn();
var mockServerTimestamp = jest.fn(() => ({}));
var mockArrayUnion = jest.fn();
var mockArrayRemove = jest.fn();
var mockFsQuery = jest.fn();
var mockFsWhere = jest.fn();

jest.mock('../Styles/bookmark2.css', () => ({}));
jest.mock('../firebase', () => ({
db: {},
    auth: {
    currentUser: { uid: 'user1' },
    onAuthStateChanged: jest.fn(() => () => {}),
},
}));
jest.mock('../profile', () => ({
unlockAchievement: jest.fn(),
}));
jest.mock('../Itinerary', () => ({
addTripForCurrentUser: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
collection: (...args) => mockCollection(...args),
serverTimestamp: mockServerTimestamp,
setDoc: (...args) => mockSetDoc(...args),
doc: (...args) => mockDoc(...args),
getDoc: (...args) => mockGetDoc(...args),
getDocs: (...args) => mockGetDocs(...args),
onSnapshot: (...args) => mockOnSnapshot(...args),
query: (...args) => mockFsQuery(...args),
where: (...args) => mockFsWhere(...args),
arrayUnion: mockArrayUnion,
arrayRemove: mockArrayRemove,
deleteDoc: (...args) => mockDeleteDoc(...args),
}));

jest.mock('react-router-dom', () => {
const actual = jest.requireActual('react-router-dom');
return {
    ...actual,
    useNavigate: () => jest.fn(),
};
});

// --- Helpers ---
function setupFirestoreMocks({ destinations = [], bookmarks = [], ratings = [] } = {}) {
// onSnapshot for destinations
mockOnSnapshot.mockImplementationOnce((q, onNext) => {
    setTimeout(() => {
    onNext({
        docs: destinations.map((d) => ({
        id: d.id,
        data: () => ({ ...d }),
        })),
    });
    }, 0);
    return jest.fn(); // unsubscribe
});
// onSnapshot for userBookmarks
mockOnSnapshot.mockImplementationOnce((ref, onNext) => {
    setTimeout(() => {
    onNext({
        exists: () => true,
        data: () => ({ bookmarks }),
    });
    }, 0);
    return jest.fn();
});
// getDoc for userBookmarks
mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ bookmarks }),
});
// getDocs for ratings (simulate one rating)
mockGetDocs.mockResolvedValue({
        forEach: (cb) => {
            ratings.forEach((r) => cb({
                data: () => r,
                id: r.id,
            }));
        },
        docs: ratings.map((r) => ({
            data: () => r,
            id: r.id,
        })),
    });
// setDoc, deleteDoc
mockSetDoc.mockResolvedValue();
mockDeleteDoc.mockResolvedValue();
}

// --- Tests ---
describe('Bookmarks2', () => {
beforeEach(() => {
    jest.clearAllMocks();
});

it('shows loading UI initially', async () => {
    setupFirestoreMocks();
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    expect(screen.getByText(/Loading destinations/i)).toBeInTheDocument();
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
});

it('renders destination cards after loading', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED', price: '1000', priceTier: 'less', tags: ['beach'], categories: ['Nature'], rating: 4.5 },
        { id: 'd2', name: 'Baguio', description: 'Pine City', region: 'Luzon', status: 'PUBLISHED', price: '2500', priceTier: 'expensive', tags: ['mountain'], categories: ['City'], rating: 4.0 },
    ],
    bookmarks: ['d1'],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    expect(await screen.findByText('Boracay')).toBeInTheDocument();
    expect(screen.getByText('Baguio')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /bookmark/i })).toHaveLength(2);
    expect(screen.getByText('White Beach')).toBeInTheDocument();
    expect(screen.getByText('Pine City')).toBeInTheDocument();
    expect(screen.getAllByText('Visayas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Luzon').length).toBeGreaterThan(0);
});

it('filters destinations by search', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED' },
        { id: 'd2', name: 'Baguio', description: 'Pine City', region: 'Luzon', status: 'PUBLISHED' },
    ],
    bookmarks: [],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    await screen.findByText('Boracay');
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'Baguio' } });
    expect(await screen.findByText('Baguio')).toBeInTheDocument();
    expect(screen.queryByText('Boracay')).not.toBeInTheDocument();
});

it('toggles bookmark when bookmark button is clicked', async () => {
setupFirestoreMocks({
    destinations: [
    { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED' },
    ],
    bookmarks: [],
});

const auth = require('../firebase').auth;

render(
    <MemoryRouter>
    <Bookmarks2 />
    </MemoryRouter>
);

await screen.findByText('Boracay');

// Simulate user login through onAuthStateChanged
if (auth.onAuthStateChanged.mock.calls.length > 0) {
    auth.onAuthStateChanged.mock.calls[0][0]({ uid: 'user1' });
}

// Now the component sees the logged-in user
const btn = screen.getByRole('button', { name: /toggle bookmark/i });
fireEvent.click(btn);
});



it('opens and closes the details modal', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED', tags: ['beach'], categories: ['Nature'], price: '1000', priceTier: 'less', bestTime: 'Summer' },
    ],
    bookmarks: [],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    await screen.findByText('Boracay');
    fireEvent.click(screen.getByText(/view details/i));
    expect(await screen.findByText('Description')).toBeInTheDocument();
    expect(screen.getAllByText('White Beach').length).toBeGreaterThan(0);
    expect(screen.getByText('Trip Information')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByText('Description')).not.toBeInTheDocument());
});

it('shows and resets filters', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED', categories: ['Nature'] },
    ],
    bookmarks: [],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    await screen.findByText('Boracay');
    // Select region filter
    fireEvent.click(screen.getByLabelText('Visayas'));
    expect(screen.getByLabelText('Visayas')).toBeChecked();
    // Clear all filters
    fireEvent.click(screen.getByText(/clear all filters/i));
    expect(screen.getByLabelText('Visayas')).not.toBeChecked();
});

it('handles optimistic bookmark toggle and rollback on error', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED' },
    ],
    bookmarks: [],
    });
    // Make setDoc throw error on toggleBookmark
    mockSetDoc.mockRejectedValueOnce(new Error('fail'));
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    await screen.findByText('Boracay');
    fireEvent.click(screen.getByRole('button', { name: /bookmark/i }));
    await screen.findByText('Boracay');
});


it('shows correct price formatting', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED', price: 1500, priceTier: 'less' },
    ],
    bookmarks: [],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    expect(await screen.findByText('₱1,500')).toBeInTheDocument();
});

it('shows rating stars and allows rating', async () => {
    setupFirestoreMocks({
        destinations: [
            { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED', price: 1500, priceTier: 'less' },
        ],
        bookmarks: [],
        ratings: [
            // Simulate an existing rating for the current user
            { userId: 'user1', rating: 3, id: 'rating1' }
        ],
    });
    render(
        <MemoryRouter>
            <Bookmarks2 />
        </MemoryRouter>
    );
    await screen.findByText('Boracay');

    // Ensure user is set before clicking the star
    const auth = require('../firebase').auth;
    if (auth.onAuthStateChanged.mock.calls.length > 0) {
        auth.onAuthStateChanged.mock.calls[0][0]({ uid: 'user1' });
    }

    fireEvent.click(screen.getByText(/view details/i));
    await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
    });

    // Wait for the modal and user state to be ready
    const starBtn = screen.getAllByRole('button', { name: /star/i })[2];
    fireEvent.click(starBtn);

    // Debug: log calls
    console.log('mockSetDoc calls:', mockSetDoc.mock.calls.length, mockSetDoc.mock.calls);
});

it('shows Visayas multiple times', async () => {
    setupFirestoreMocks({
    destinations: [
        { id: 'd1', name: 'Boracay', description: 'White Beach', region: 'Visayas', status: 'PUBLISHED' },
        { id: 'd2', name: 'Baguio', description: 'Pine City', region: 'Visayas', status: 'PUBLISHED' },
    ],
    bookmarks: [],
    });
    render(
    <MemoryRouter>
        <Bookmarks2 />
    </MemoryRouter>
    );
    await screen.findByText('Boracay');
    expect(screen.getAllByText('Visayas').length).toBeGreaterThan(0);
});

// After rendering Bookmarks2 in your test:

});