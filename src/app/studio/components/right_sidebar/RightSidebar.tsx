import AnchorPointsList from './AnchorPointsList';
import ControlPointsList from './ControlPointsList';

export default function RightSidebar() {
	return( 
    <aside className="w-75 bg-gray-850 border-l border-gray-700 flex flex-col overflow-auto">
      <div className="p-5">            
        <AnchorPointsList />
        <ControlPointsList />
      </div>
    </aside>
	);
}