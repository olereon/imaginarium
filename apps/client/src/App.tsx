import { Button, Card } from '@imaginarium/ui';
import { generateId } from '@imaginarium/shared';

export function App() {
  const handleClick = () => {
    console.log('Generated ID:', generateId('test'));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card title="Imaginarium" className="max-w-2xl mx-auto">
        <p className="mb-4">
          Welcome to Imaginarium - AI Content Generation Pipeline Platform
        </p>
        <Button onClick={handleClick} variant="primary">
          Generate ID
        </Button>
      </Card>
    </div>
  );
}