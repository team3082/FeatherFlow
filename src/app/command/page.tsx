"use client";

// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { useProjectStore } from '@/store/ProjectStore';
// import Header from '@/components/layout/Header';
// import Footer from './components/Footer';
// import { LeftSidebar } from './components/LeftSidebar';
// import RightSidebar from './components/RightSidebar';
// import { CommandField } from './components/CommandField';
// import { useNodesState, useEdgesState, addEdge, Node, Edge, Connection } from 'reactflow';

// const initialNodes: Node[] = [
//   { id: '1', position: { x: 0, y: 0 }, data: { label: 'Start' } },
// ];

// export default function CommandPage() {
//   const router = useRouter();
//   const isProjectLoaded = useProjectStore(state => state.isProjectLoaded);
//   const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
//   const [edges, setEdges, onEdgesChange] = useEdgesState([]);

//   const addNode = (type: string) => {
//     const newNode: Node = {
//       id: `${Date.now()}`,
//       type: 'default',
//       position: { 
//         x: Math.random() * 400,
//         y: Math.random() * 400,
//        },
//       data: { label: `${type}` },
//     };
//     setNodes((nds) => nds.concat(newNode));
//       console.log('Current nodes:', nodes);

//   };


//   const onConnect = (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds));

//   useEffect(() => {
//     if (!isProjectLoaded) {
//       router.push('/');
//     }
//   }, [isProjectLoaded, router]);

//   if (!isProjectLoaded) {
//     return null; // Or a loading spinner
//   }

//   return (
//     <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
//       <Header />
//       <main className="flex flex-1 overflow-hidden">
//         <LeftSidebar addNode={addNode} />
//         <CommandField 
//           nodes={nodes} 
//           edges={edges}
//           onNodesChange={onNodesChange}
//           onEdgesChange={onEdgesChange}
//           onConnect={onConnect}
//         />
//         <RightSidebar />
//       </main>
//       <Footer />
//     </div>
//   );
// }

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const QuestionCard = ({ number, question, answer }) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-blue-500">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
          {number}
        </div>
        <div className="flex-1">
          <div className="prose max-w-none">
            <div className="text-gray-800 mb-4">{question}</div>
          </div>
          
          <button
            onClick={() => setIsRevealed(!isRevealed)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            {isRevealed ? (
              <>
                <ChevronUp size={20} />
                Hide Answer
              </>
            ) : (
              <>
                <ChevronDown size={20} />
                Reveal Answer
              </>
            )}
          </button>
          
          {isRevealed && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="prose max-w-none text-gray-700">
                {answer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function TeleopAutomationGuide() {

  const questions = [

    // -------------------
    // TASK 1
    // -------------------
    {
      number: 1,
      question: (
        <div>
          <p className="font-semibold mb-2">Moving Controls to OI.java</p>
          <p>Currently in the codebase, operation and driver control is set up strangely – the drive motor is labeled "sadstick" in robot.java. I want you to move the drive and operator controls to OI.java. You can do this by defining two object instances of the joystick.</p>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold mb-2">Solution:</p>
          <p className="mb-2">In <code className="bg-gray-200 px-2 py-1 rounded">OI.java</code>, create two Joystick instances:</p>

<pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto mb-2">
{`public class OI {
    public static Joystick driverJoystick = new Joystick(0);
    public static Joystick operatorJoystick = new Joystick(1);
}`}
</pre>

          <p className="text-sm">Remove the "sadstick" declaration from robot.java and update any references to use <code className="bg-gray-200 px-1 rounded">OI.driverJoystick</code> instead.</p>
        </div>
      )
    },

    // -------------------
    // TASK 2
    // -------------------
    {
      number: 2,
      question: (
        <div>
          <p className="font-semibold mb-2">Adding Speed Boost with Trigger</p>
          <p className="mb-2">Let's make driving easier. The build season robot has the ability to go faster if you pull down the right top trigger. Here's what to do:</p>
          <ol className="list-decimal ml-6 space-y-2">
            <li>Go to driver station and find the button ID for the right top trigger</li>
            <li>In OI, print the output of <code>getRawButtonPressed</code> on that button index to verify</li>
            <li>Implement speed control logic based on that button</li>
          </ol>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold mb-2">Solution:</p>

<pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto">
{`double speed;

if (OI.driverJoystick.getRawButton(6)) {
    speed = 1.0;
} else {
    speed = 0.75;
}

Drivetrain.setSpeedLeft(driverStick.getRawAxis(1) * speed);
Drivetrain.setSpeedRight(driverStick.getRawAxis(5) * speed);`}
</pre>

        </div>
      )
    },

    // -------------------
    // TASK 3
    // -------------------
    {
      number: 3,
      question: (
        <div>
          <p className="font-semibold mb-2">Testing and Tuning</p>
          <p>Drive around and adjust values to find the most comfortable control feel.</p>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold mb-2">Testing Tips:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Try normal speed (0.75) for precision</li>
            <li>Try full speed (1.0) with trigger</li>
            <li>Experiment with 0.8–0.9 as intermediate speed values</li>
          </ul>
        </div>
      )
    },

    // -------------------
    // TASK 4 — IDEATION WITH SOLUTION
    // -------------------
    {
      number: 4,
      question: (
        <div>
          <p className="font-semibold mb-2">Jiggle Automation — Step 1: Ideation</p>

          <p className="mb-2">
            When the robot is shooting, we want a very slight motion pattern that helps the popcorn settle 
            into the shooter rotate. The drivetrain should shift gently left/right, but 
            **you must determine how**.
          </p>

          <p className="font-semibold text-gray-700 mt-4">Think about:</p>

          <ul className="list-disc ml-6 space-y-2">
            <li>How to make the robot repeatedly move left then right</li>
            <li>How to ensure the movement is smooth, not jerky</li>
            <li>How to make the pattern continuous without writing long lists of values</li>
            <li>How to keep the effect small so it doesn't disrupt aim</li>
          </ul>

          <p className="mt-4 italic text-gray-600">
            Once you have an idea for producing a back-and-forth motion, reveal the answer.
          </p>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold">
            The Answer: Use a Sine Wave
          </p>

          <p className="mb-4">
            The cleanest way to generate a continuous left-right motion is a <strong>sine wave</strong>.  
            Sine waves naturally rise and fall smoothly, making them perfect for a controlled jiggle.
          </p>

          <div className="my-6 flex justify-center">
            <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='300' viewBox='0 0 600 250'>
              {/* Grid lines */}
              <line x1='0' y1='125' x2='600' y2='125' stroke='#e0e0e0' strokeWidth='1' />
              
              {/* Sine wave */}
              <polyline
                fill='none'
                stroke='#007bff'
                strokeWidth='3'
                points='
                  10,125 30,108 50,92 70,78 90,67 110,60 130,58 150,60 170,67 190,78
                  210,92 230,108 250,125 270,142 290,158 310,170 330,178 350,182 370,182
                  390,178 410,170 430,158 450,142 470,125 490,108 510,92 530,78 550,67 570,60
                '
              />
              
              {/* Axes */}
              <line x1='0' y1='125' x2='600' y2='125' stroke='#333' strokeWidth='2' />
              <line x1='0' y1='30' x2='0' y2='220' stroke='#333' strokeWidth='2' />
              
              {/* Labels */}
              <text x='580' y='145' fontSize='12' fill='#333'>Time</text>
              <text x='15' y='20' fontSize='12' fill='#333'>Speed</text>
            </svg>
          </div>

          <p className="mb-4">
            <strong>Why sine waves work:</strong>
          </p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Smooth acceleration and deceleration (no jerky movements)</li>
            <li>Continuous oscillation without complex logic</li>
            <li>Easy to control amplitude (how far) and frequency (how fast)</li>
            <li>Built into math libraries: <code className="bg-gray-200 px-1 rounded">Math.sin()</code></li>
          </ul>
        </div>
      )
    },

    // -------------------
    // TASK 5 — IMPLEMENTATION ONLY
    // -------------------
    {
      number: 5,
      question: (
        <div>
          <p className="font-semibold mb-2">Jiggle Automation — Step 2: Implementation</p>

          <p>
            Now implement the sine wave pattern inside 
            <code className="bg-gray-200 px-1 rounded ml-1">if (isShooting)</code>  
            to make the drivetrain move left and right repeatedly.
          </p>

          <p className="mt-4 font-semibold">Try first before revealing the solution.</p>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold mb-4">Implementation Solution:</p>

<pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto">
{`if (isShooting) {
    double time = Timer.getFPGATimestamp();

    double frequency = 6.0;       // how fast it shifts
    double amplitude = 0.15;      // how far it shifts

    double wiggle = Math.sin(time * frequency) * amplitude;

    drivetrain.setLeftSpeed(baseSpeed + wiggle);
    drivetrain.setRightSpeed(baseSpeed - wiggle);  // inverted
}`}
</pre>
        </div>
      )
    },

    // -------------------
    // TASK 6 — TUNING (kept as is)
    // -------------------
    {
      number: 6,
      question: (
        <div>
          <p className="font-semibold mb-2">Jiggle Automation — Step 3: Tuning</p>
          <p>Now tune frequency and amplitude so the jiggle feels right.</p>
        </div>
      ),
      answer: (
        <div>
          <p className="font-semibold mb-2">Tuning Recommendations</p>

          <ul className="list-disc ml-6 space-y-2">
            <li><strong>Amplitude:</strong>  
              <ul className="list-disc ml-6 mt-1">
                <li>0.05 = very subtle</li>
                <li>0.15 = normal</li>
                <li>0.25 = strong</li>
              </ul>
            </li>

            <li><strong>Frequency:</strong>
              <ul className="list-disc ml-6 mt-1">
                <li>4 Hz = slow sway</li>
                <li>6 Hz = ideal</li>
                <li>8–10 Hz = fast wobble</li>
              </ul>
            </li>

            <li>Print the wiggle value to monitor its behavior.</li>
          </ul>

        </div>
      )
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Preface */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Teleop Automation Guide</h1>
          <p className="text-gray-600 mb-4">
            Since I am out, I wanted to try seeing how well asynchronous guides such as these 
            can be for learning. Down below are tasks alongside answers you can reveal.  
            If you get too confused, try asking Oliver for help.
          </p>
          <p className="text-gray-600">
            Programming challenges for improving robot control.
          </p>
        </div>

        {questions.map((q) => (
          <QuestionCard
            key={q.number}
            number={q.number}
            question={q.question}
            answer={q.answer}
          />
        ))}

      </div>
    </div>
  );
}
